# Rahmadani Tyas Ningrum: Portfolio

Personal portfolio for Rahmadani Tyas Ningrum, Test Lead and Senior Automation SDET. It is a static site (HTML, CSS and
JavaScript, no build step), based on the open-source [vCard template](https://github.com/codewithsadee/vcard-personal-portfolio) (MIT).

## Structure

```
index.html                  About, Resume, Portfolio, Publications, Insights, Contact
articles/*.html             Insight articles (eUICC, HSM, CBDC, BDD, Jenkins/Jira, release readiness)
assets/css/style.css        Main site styles (colour tokens at the top)
assets/css/article.css      Article page styles
assets/js/script.js         Navigation, portfolio filter and modal, citation copy, contact form
assets/js/article.js        Share and copy-link on article pages
assets/images/avatar-memoji.png   Memoji avatar (favicon.png is the small version)
assets/docs/Rahmadani-Tyas-Ningrum-CV.pdf   Downloadable CV
sitemap.xml, robots.txt, .nojekyll
```

Sections can be linked directly, e.g. `index.html#insights` or `index.html#contact`.

## Common edits

- **Change the avatar:** replace `assets/images/avatar-memoji.png` (square, transparent background works best) and
  `assets/images/favicon.png` (64 x 64).
- **Colours and light/dark mode:** all colours are tokens at the top of `assets/css/style.css` (dark theme in `:root`,
  light theme in the `[data-theme="light"]` block). `assets/css/article.css` mirrors them for the article pages.
- **Update the CV:** overwrite `assets/docs/Rahmadani-Tyas-Ningrum-CV.pdf` (keep the file name).
- **Add a portfolio item:** copy one `<li class="project-item">` block in `index.html`. The `data-category` value must
  match a filter button's text in lower case.
- **Contact form:** it opens the visitor's email app with the message pre-filled, so it needs no server. To receive
  messages without an email app, sign up at a free form service such as Formspree and change the form's `action`.

## Live site

Published with GitHub Pages at **https://artysficial.github.io/** from the `artysficial/artysficial.github.io`
repository. Every push to `main` redeploys the site within a minute or two.

## Free hosting on GitHub Pages

1. Create a GitHub account if you do not have one, then create a **public** repository, for example `portfolio`.
2. In this folder, point git at your repository and push:
   ```bash
   git config user.name "Rahmadani Tyas Ningrum"
   git config user.email "artysficial@gmail.com"
   git remote set-url origin https://github.com/<your-username>/portfolio.git
   git add -A
   git commit -m "Personal portfolio"
   git push -u origin master
   ```
3. On GitHub, open **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `master` and `/ (root)`, then save.
4. After a minute the site is live at `https://<your-username>.github.io/portfolio/`.

Netlify and Cloudflare Pages are free alternatives: drag and drop this folder, or connect the repository.

## Custom domain (www.artysficial.co.id)

Hosting is free, but the domain itself must be registered with a PANDI-accredited registrar, which is a paid yearly
fee. Note that **`.co.id` is reserved for registered businesses** and requires company documents. For an individual,
`artysficial.my.id` (personal, needs a KTP) or `artysficial.id` are the usual choices.

Once you own the domain:

1. At your registrar's DNS settings, add a `CNAME` record: `www` → `<your-username>.github.io`.
   For the bare domain, add `A` records pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`.
2. In **Settings → Pages → Custom domain**, enter `www.artysficial.co.id` (or your chosen domain), save, and tick
   **Enforce HTTPS** once it becomes available.
3. Find and replace `https://artysficial.github.io` with your new address in `index.html`, `articles/*.html`,
   `sitemap.xml` and `robots.txt`.
