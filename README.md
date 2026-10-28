# Rahmadani Tyas Ningrum: Portfolio

Personal portfolio for Rahmadani Tyas Ningrum, Test Lead and Senior Automation SDET. It is a Node.js app (Express and
EJS templates) based on the open-source [vCard template](https://github.com/codewithsadee/vcard-personal-portfolio) (MIT).

What the server adds over a static site:

- **Contact form that emails you.** Messages are validated, checked for spam (hidden honeypot field, time check, rate
  limit), sent to your inbox over SMTP, and also stored so nothing is lost if email delivery fails.
- **Content from data files.** Resume, projects, publications and articles live in `content/`, not in HTML.
- **CV download tracking.** Every download is counted with the button used, the referring site and the device type,
  on a private, password-protected `/admin` page. Crawlers are not counted and no IP addresses are stored.
- **SEO and operations.** Generated `sitemap.xml` and `robots.txt`, security headers (CSP with per-request nonces),
  compression, cache-busted assets, a `/healthz` endpoint, and 301 redirects from the old `.html` URLs.

## Run it locally

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env     # then fill in SMTP_PASS and ADMIN_PASSWORD
npm run dev              # restarts on code changes; http://localhost:3000
npm test                 # pages, contact form, CV tracking, admin, storage, SEO, security
```

In development, edits to `content/` show up on refresh. Without SMTP settings, contact messages are stored and logged
instead of emailed.

## Structure

```
server.js                   Starts the app
src/app.js                  Routes, security headers, caching, CV download, sitemap, robots, health check
src/content.js              Loads content/*.json and the articles
src/contact.js              Contact form validation, spam checks and delivery
src/mailer.js               SMTP sending (nodemailer)
src/admin.js                Basic auth and download/message statistics
src/store.js                Storage: MongoDB when MONGODB_URI is set, otherwise JSON Lines files in data/
content/site.json           Profile, contacts, about text, stats, featured project, services
content/resume.json         Experience, education, certifications, skills
content/projects.json       Portfolio items and filter categories
content/publications.json   Publications
content/articles/*.html     Insight articles (front matter + HTML body); *.md works too
views/                      EJS templates (index, article, admin, 404)
public/assets/              CSS, browser JS, images and the CV PDF
test/                       node:test + supertest
```

## Common edits

- **Update the CV:** overwrite `public/assets/docs/Rahmadani-Tyas-Ningrum-CV.pdf` (keep the file name).
- **Change a job, skill or certificate:** edit `content/resume.json`.
- **Add a portfolio item:** add an object to `content/projects.json`. Its `category` must be one of `categories`.
- **Write a new article:** add `content/articles/my-topic.md` (or `.html`) starting with front matter:

  ```markdown
  ---
  title: "My article title"
  description: "One or two sentences for search results and the card."
  category: "Test automation"
  date: "2026-11-15"
  readTime: "5 min read"
  hue: 20
  icon: "document-text-outline"
  ---
  ## First heading

  Article text in Markdown...
  ```

  It appears in Insights, under "More insights" on every article, and in the sitemap. Articles without `order` are
  listed newest first after the ordered ones. Add `draft: true` to hide one. `icon` is any
  [Ionicons 5](https://ionic.io/ionicons) name.
- **Colours and light/dark mode:** tokens at the top of `public/assets/css/style.css` and `article.css`.

## Configuration

Set these as environment variables on the host, or in `.env` locally (see `.env.example`):

| Variable | Purpose |
|---|---|
| `SITE_URL` | Public address, used for canonical links, the sitemap and social previews |
| `SMTP_USER`, `SMTP_PASS` | Mailbox that sends contact messages. For Gmail, `SMTP_PASS` must be an [app password](https://myaccount.google.com/apppasswords), not your normal password |
| `SMTP_HOST`, `SMTP_PORT` | Defaults to `smtp.gmail.com` and `465` |
| `MAIL_TO` | Where messages are delivered; defaults to the email in `content/site.json` |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Login for `/admin`; the page is disabled while `ADMIN_PASSWORD` is empty |
| `MONGODB_URI` | Optional. Stores downloads and messages in MongoDB (e.g. a free Atlas cluster) instead of files |
| `MONGODB_DB` | Database name when `MONGODB_URI` is set; defaults to `portfolio` |
| `DATA_DIR` | Where downloads and messages are stored without MongoDB; defaults to `./data` |
| `PORT` | Set automatically by most hosts |

## Deploy for free (Render + MongoDB Atlas)

GitHub Pages only serves static files, so the Node server runs on Render's free plan. Render's free disk is wiped
whenever the service restarts, so CV downloads and messages go to a free MongoDB Atlas database instead.

**1. Free database (MongoDB Atlas)**

1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas/register) and create a free **M0** cluster.
2. Under **Database Access**, add a user with a password.
3. Under **Network Access**, allow `0.0.0.0/0` (Render's free plan has no fixed IP address).
4. Under **Connect > Drivers**, copy the connection string and put your password in it. That is `MONGODB_URI`.

**2. Free hosting (Render)**

1. Push this repository to GitHub.
2. On [render.com](https://render.com), sign in with GitHub, choose **New > Blueprint** and pick the repository.
   `render.yaml` configures the plan, build, start command, health check and environment variables.
3. When asked, enter `SITE_URL` (for example `https://artysficial-portfolio.onrender.com`), `SMTP_USER`,
   `SMTP_PASS`, `ADMIN_PASSWORD` and `MONGODB_URI`.
4. Every push to the deployed branch redeploys the site.

The free plan sleeps after 15 minutes without visitors, so the first visit afterwards takes up to a minute. For an
always-on site, switch `render.yaml` to `plan: starter` (paid).

## Moving from GitHub Pages

The previous static version was published from this repository at https://artysficial.github.io/. Old links such as
`/index.html`, `/articles/hsm-testing.html` and `/assets/docs/Rahmadani-Tyas-Ningrum-CV.pdf` keep working on the new
server. Once the Node version is live, either point a custom domain at Render, or replace the GitHub Pages site with a
small page that redirects to the new address, and update the links on LinkedIn and in the CV.
