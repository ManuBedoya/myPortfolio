#!/usr/bin/env node
// Post-build guard for the static site in `dist/`.
//
// Fails the build (exit 1) when:
//  (a) an inline executable script is not allowed by a CSP hash in netlify.toml,
//      or the CSP keeps a hash that no page uses anymore (stale);
//  (b) an in-page anchor (`/#id` or `#id`) targets an id that does not exist;
//  (c) a `/proyectos/<slug>/` link has no built page;
//  (d) the Netlify contact form lost its detection attributes, honeypot,
//      `form-name` field or input labels;
//  (e) the sitemap or robots.txt is missing, or a page lacks a canonical URL
//      or an absolute `og:image`.
//
// No dependencies: plain regex scanning of the generated HTML is enough here
// because Astro emits predictable, double-quoted attributes.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const NETLIFY_TOML = join(ROOT, 'netlify.toml');

const errors = [];
const fail = (check, message) => errors.push(`[${check}] ${message}`);

// ---------- helpers ----------

function listHtmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

function getAttr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s/>])`, 'i'));
  if (!match) return undefined;
  return match[1] ?? '';
}

const NON_EXECUTABLE_TYPES = new Set(['application/ld+json', 'application/json']);

function inlineExecutableScripts(html) {
  const scripts = [];
  for (const match of html.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/gi)) {
    const [, openTag, body] = match;
    const type = (getAttr(openTag, 'type') ?? '').toLowerCase();
    if (getAttr(openTag, 'src') !== undefined) continue;
    if (NON_EXECUTABLE_TYPES.has(type)) continue;
    scripts.push(body);
  }
  return scripts;
}

const sha256 = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;

function cspHashes() {
  if (!existsSync(NETLIFY_TOML)) {
    fail('a', 'netlify.toml is missing.');
    return new Set();
  }
  const toml = readFileSync(NETLIFY_TOML, 'utf8');
  const csp = toml.match(/Content-Security-Policy\s*=\s*"([^"]*)"/);
  if (!csp) {
    fail('a', 'netlify.toml has no Content-Security-Policy header.');
    return new Set();
  }
  if (/script-src[^;]*'unsafe-inline'/.test(csp[1])) {
    fail('a', "CSP script-src must not use 'unsafe-inline'.");
  }
  return new Set(csp[1].match(/sha256-[A-Za-z0-9+/=]+/g) ?? []);
}

function idsIn(html) {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
}

// ---------- checks ----------

function checkCspHashes(pages) {
  const allowed = cspHashes();
  const used = new Map(); // hash -> files that contain the script
  for (const { file, html } of pages) {
    for (const body of inlineExecutableScripts(html)) {
      const hash = sha256(body);
      used.set(hash, [...(used.get(hash) ?? []), file]);
    }
  }
  for (const [hash, files] of used) {
    if (!allowed.has(hash)) {
      fail('a', `inline script '${hash}' (in ${files.join(', ')}) is not in netlify.toml CSP script-src.`);
    }
  }
  for (const hash of allowed) {
    if (!used.has(hash)) fail('a', `netlify.toml CSP has stale hash '${hash}' (no inline script uses it).`);
  }
}

function checkAnchors(pages, homeIds) {
  for (const { file, html } of pages) {
    const pageIds = idsIn(html);
    for (const [, path, id] of html.matchAll(/href="(\/?)#([^"]+)"/g)) {
      // `/#id` targets the home page; a bare `#id` targets the current page.
      const ids = path === '/' ? homeIds : pageIds;
      if (!ids.has(id)) fail('b', `${file}: link to '${path}#${id}' has no matching id.`);
    }
  }
}

function checkProjectLinks(pages) {
  for (const { file, html } of pages) {
    for (const [, slug] of html.matchAll(/href="\/proyectos\/([^"/#?]+)\/?"/g)) {
      if (!existsSync(join(DIST, 'proyectos', slug, 'index.html'))) {
        fail('c', `${file}: link to /proyectos/${slug}/ has no built page.`);
      }
    }
  }
}

function isWrappedInLabel(formHtml, index) {
  const before = formHtml.slice(0, index);
  return before.lastIndexOf('<label') > before.lastIndexOf('</label>');
}

function checkContactForm(homeHtml) {
  const match = homeHtml.match(/(<form\b[^>]*\sname="contact"[^>]*>)([\s\S]*?)<\/form>/);
  if (!match) {
    fail('d', 'dist/index.html has no <form name="contact">.');
    return;
  }
  const [, formTag, body] = match;
  if (getAttr(formTag, 'data-netlify') !== 'true') fail('d', 'contact form lacks data-netlify="true".');
  if (getAttr(formTag, 'netlify-honeypot') !== 'bot-field') fail('d', 'contact form lacks netlify-honeypot="bot-field".');
  if (!/<input\b[^>]*\sname="bot-field"/.test(body)) fail('d', 'contact form lacks the bot-field honeypot input.');
  if (!/<input\b(?=[^>]*\stype="hidden")(?=[^>]*\sname="form-name")(?=[^>]*\svalue="contact")[^>]*>/.test(body)) {
    fail('d', 'contact form lacks the hidden form-name="contact" input.');
  }

  const labelTargets = new Set([...body.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]));
  for (const control of body.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
    const tag = control[0];
    if (getAttr(tag, 'type') === 'hidden') continue;
    const id = getAttr(tag, 'id');
    const labelled = (id && labelTargets.has(id)) || isWrappedInLabel(body, control.index);
    if (!labelled) fail('d', `contact form control '${getAttr(tag, 'name') ?? tag}' has no <label>.`);
  }
}

function checkSeo(pages) {
  for (const name of ['sitemap-index.xml', 'robots.txt']) {
    if (!existsSync(join(DIST, name))) fail('e', `dist/${name} is missing.`);
  }
  for (const { file, html } of pages) {
    const canonical = html.match(/<link\b[^>]*\srel="canonical"[^>]*>/);
    if (!canonical || !/^https:\/\//.test(getAttr(canonical[0], 'href') ?? '')) {
      fail('e', `${file}: missing absolute canonical link.`);
    }
    const ogImage = html.match(/<meta\b[^>]*\sproperty="og:image"[^>]*>/);
    const ogImageUrl = ogImage && getAttr(ogImage[0], 'content');
    if (!ogImageUrl || !/^https:\/\//.test(ogImageUrl)) {
      fail('e', `${file}: missing absolute og:image.`);
    } else if (!existsSync(join(DIST, decodeURIComponent(new URL(ogImageUrl).pathname)))) {
      fail('e', `${file}: og:image '${ogImageUrl}' is not in dist.`);
    }
  }
}

// ---------- main ----------

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('verify-dist: dist/index.html not found. Run `astro build` first.');
  process.exit(1);
}

const pages = listHtmlFiles(DIST).map((path) => ({
  file: relative(ROOT, path),
  html: readFileSync(path, 'utf8'),
}));
const homeHtml = readFileSync(join(DIST, 'index.html'), 'utf8');

checkCspHashes(pages);
checkAnchors(pages, idsIn(homeHtml));
checkProjectLinks(pages);
checkContactForm(homeHtml);
checkSeo(pages);

if (errors.length > 0) {
  console.error(`verify-dist: ${errors.length} problem(s) found in dist/:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`verify-dist: OK (${pages.length} pages; CSP hashes, anchors, project links, contact form, SEO).`);
