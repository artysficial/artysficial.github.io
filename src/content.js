'use strict';

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const { marked } = require('marked');

const REQUIRED_ARTICLE_FIELDS = ['title', 'description', 'category', 'date', 'readTime'];

const readJson = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));

// YAML turns an unquoted 2026-10-27 into a Date; keep every date as YYYY-MM-DD
const toIsoDate = (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value));

// articles are .html or .md files with front matter; Markdown bodies are rendered with marked
function loadArticles(dir) {
  return fs.readdirSync(dir)
    .filter((file) => /\.(html|md)$/.test(file))
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, file), 'utf8'));
      const missing = REQUIRED_ARTICLE_FIELDS.filter((field) => !data[field]);
      if (missing.length) throw new Error(`${file}: missing front matter ${missing.join(', ')}`);

      return {
        lead: data.description,
        excerpt: data.description,
        hue: 20,
        icon: 'document-text-outline',
        ...data,
        date: toIsoDate(data.date),
        slug: path.parse(file).name,
        html: file.endsWith('.md') ? marked.parse(content) : content,
      };
    })
    .filter((article) => !article.draft)
    // explicit order first, then newest first
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || b.date.localeCompare(a.date));
}

function loadContent(dir) {
  const articles = loadArticles(path.join(dir, 'articles'));

  return {
    site: readJson(dir, 'site.json'),
    resume: readJson(dir, 'resume.json'),
    projects: readJson(dir, 'projects.json'),
    publications: readJson(dir, 'publications.json'),
    articles,
    articleBySlug: new Map(articles.map((article) => [article.slug, article])),
  };
}

module.exports = { loadContent };
