'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');

const { loadContent } = require('./content');
const { createStores } = require('./store');
const { createMailer } = require('./mailer');
const { contactHandler } = require('./contact');
const { basicAuth, summarise } = require('./admin');

const ROOT = path.join(__dirname, '..');
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget/i;
const CV_SOURCE = /^[a-z0-9-]{1,30}$/;
const CONTACT_STATUS = new Set(['sent', 'invalid', 'error']);

// "?v=<hash>" on CSS/JS URLs, so long cache lifetimes never serve a stale file after a deploy
function assetVersioner(publicDir) {
  const versions = new Map();
  return (url) => {
    if (!versions.has(url)) {
      const file = fs.readFileSync(path.join(publicDir, url));
      versions.set(url, crypto.createHash('sha1').update(file).digest('hex').slice(0, 10));
    }
    return `${url}?v=${versions.get(url)}`;
  };
}

function referrerOf(req) {
  try {
    const url = new URL(req.get('referer'));
    return url.host === req.get('host') ? 'this site' : url.host;
  } catch {
    return 'direct';
  }
}

const deviceOf = (userAgent) => (/mobile|android|iphone|ipad/i.test(userAgent) ? 'mobile' : 'desktop');

const escapeXml = (value) => value.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];

// "2022-09" or "2022-09-14" -> "September 2022" ("Sep 2022" when short)
const monthYear = (isoDate, short = false) => {
  const [year, month] = isoDate.split('-');
  const name = MONTHS[Number(month) - 1];
  return `${short ? name.slice(0, 3) : name} ${year}`;
};

function createApp(options = {}) {
  const env = options.env ?? process.env;
  const production = env.NODE_ENV === 'production';
  const contentDir = options.contentDir ?? path.join(ROOT, 'content');
  const publicDir = path.join(ROOT, 'public');
  // Vercel's file system is read-only apart from the temp dir (and that is wiped often: use MONGODB_URI there)
  const dataDir = options.dataDir ?? env.DATA_DIR
    ?? (env.VERCEL ? path.join(os.tmpdir(), 'portfolio-data') : path.join(ROOT, 'data'));
  const log = options.log ?? console;

  // in development, edits to content/ show up on refresh without a restart
  const loaded = loadContent(contentDir);
  const content = () => (production ? loaded : loadContent(contentDir));

  const { site } = loaded;
  const siteUrl = (env.SITE_URL || site.url).replace(/\/+$/, '');
  const mailTo = env.MAIL_TO || site.email;
  const cvFile = path.join(publicDir, site.cv);

  const stores = options.stores ?? createStores({ env, dataDir });
  const { downloads, messages } = stores;
  const mailer = options.mailer ?? createMailer(env);

  if (production && !mailer.configured) log.warn('SMTP_USER / SMTP_PASS are not set: the contact form cannot email you.');

  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(ROOT, 'views'));
  // hosts such as Render put one proxy in front of the app; needed for correct client IPs in rate limiting
  app.set('trust proxy', env.TRUST_PROXY ? Number(env.TRUST_PROXY) : (production ? 1 : 0));

  app.locals.asset = assetVersioner(publicDir);
  app.locals.siteUrl = siteUrl;
  app.locals.monthYear = monthYear;

  app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
  });

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`, 'https://unpkg.com'],
        // inline style attributes carry the cover colours (--hue); ionicons injects its own styles
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        // ionicons fetches its SVG files at runtime
        connectSrc: ["'self'", 'https://unpkg.com'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: production ? [] : null,
      },
    },
  }));
  app.use(compression());

  // ---- pages

  app.get('/', (req, res) => {
    const status = String(req.query.contact ?? '');
    res.render('index', {
      ...content(),
      canonical: `${siteUrl}/`,
      contactStatus: CONTACT_STATUS.has(status) ? status : null,
      startedAt: Date.now(),
    });
  });

  app.get('/articles/:slug', (req, res, next) => {
    const data = content();
    const article = data.articleBySlug.get(req.params.slug);
    if (!article) return next();

    res.render('article', {
      ...data,
      article,
      canonical: `${siteUrl}/articles/${article.slug}`,
      others: data.articles.filter((other) => other.slug !== article.slug),
    });
  });

  // old static-site URLs keep working (links already shared on LinkedIn, search results)
  app.get('/index.html', (req, res) => res.redirect(301, '/'));
  app.get(/^\/articles\/([\w-]+)\.html$/, (req, res) => res.redirect(301, `/articles/${req.params[0]}`));

  // ---- CV download with tracking

  const sendCv = async (req, res, from) => {
    const userAgent = req.get('user-agent') || '';
    if (!BOT.test(userAgent)) {
      try {
        await downloads.append({ type: 'cv', from, referrer: referrerOf(req), device: deviceOf(userAgent) });
      } catch (error) {
        // a tracking failure must never block the download itself
        log.error('CV download could not be recorded:', error);
      }
    }
    res.set('Cache-Control', 'no-store');
    res.download(cvFile, path.basename(cvFile));
  };

  app.get('/cv', (req, res) => {
    const from = typeof req.query.from === 'string' && CV_SOURCE.test(req.query.from) ? req.query.from : 'direct';
    return sendCv(req, res, from);
  });
  app.get(`/${site.cv}`, (req, res) => sendCv(req, res, 'old-link'));

  // ---- contact form

  app.post(
    '/api/contact',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: options.contactLimit ?? 5,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (req, res) => res.status(429).json({
        ok: false,
        message: `Too many messages in a short time. Please try again later or email ${mailTo}.`,
      }),
    }),
    express.json({ limit: '20kb' }),
    express.urlencoded({ extended: false, limit: '20kb' }),
    contactHandler({ store: messages, mailer, mailTo, siteUrl, production, log }),
  );

  // ---- private admin page (disabled unless ADMIN_PASSWORD is set)

  if (env.ADMIN_PASSWORD) {
    app.get(
      '/admin',
      rateLimit({ windowMs: 15 * 60 * 1000, limit: options.adminLimit ?? 30, standardHeaders: 'draft-7', legacyHeaders: false }),
      basicAuth({ user: env.ADMIN_USER || 'admin', password: env.ADMIN_PASSWORD }),
      async (req, res) => {
        // show a storage problem on the page itself; the admin is the one person who can fix it
        let events = { downloads: [], messages: [] };
        let storageError = null;
        try {
          const [downloadEvents, messageEvents] = await Promise.all([downloads.all(), messages.all()]);
          events = { downloads: downloadEvents, messages: messageEvents };
        } catch (error) {
          storageError = error.message;
          log.error('Admin: storage could not be read:', error);
        }

        res.set('Cache-Control', 'no-store');
        res.render('admin', {
          site,
          stats: summarise(events),
          storageError,
          mailConfigured: mailer.configured,
          storage: stores.location,
          persistent: stores.persistent,
        });
      },
    );
  }

  // ---- SEO and operations

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const { articles } = content();
    const latest = articles.map((article) => article.date).sort().at(-1);
    const urls = [
      { loc: `${siteUrl}/`, lastmod: latest },
      ...articles.map((article) => ({ loc: `${siteUrl}/articles/${article.slug}`, lastmod: article.date })),
    ];
    res.type('application/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
      + urls.map((url) => `  <url><loc>${escapeXml(url.loc)}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}</url>`).join('\n')
      + '\n</urlset>\n',
    );
  });

  app.get('/healthz', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  app.use(express.static(publicDir, { index: false, maxAge: production ? '7d' : 0 }));

  // ---- errors

  app.use((req, res) => {
    res.status(404).render('404', { site, canonical: `${siteUrl}${req.path}` });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    log.error(error);
    if (res.headersSent) return;
    res.status(error.status || 500).type('text/plain').send('Something went wrong. Please try again later.');
  });

  return app;
}

module.exports = { createApp };
