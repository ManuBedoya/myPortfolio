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
//
// Every check is a pure function over strings (plus an `exists(relPath)`
// callback for files under dist/) that returns a list of error messages, so
// scripts/verify-dist.test.mjs can exercise them with inline fixtures. The CLI
// entry at the bottom only runs when this file is executed directly.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const error = (check, message) => `[${check}] ${message}`;

// ---------- helpers ----------

export function getAttr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s/>])`, 'i'));
  if (!match) return undefined;
  return match[1] ?? '';
}

const NON_EXECUTABLE_TYPES = new Set(['application/ld+json', 'application/json']);

export function inlineExecutableScripts(html) {
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

export const sha256 = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;

export function idsIn(html) {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
}

// Reads the Content-Security-Policy of the `[[headers]]` block whose
// `for = "/*"`. Commented lines are ignored, and a CSP in any other block
// (e.g. `/_astro/*`) does not count. Returns `{ csp, errors }`.
export function cspFromToml(toml) {
  if (toml == null) return { csp: undefined, errors: [error('a', 'netlify.toml is missing.')] };

  const blocks = [];
  let current;
  for (const rawLine of toml.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (/^\[\[\s*headers\s*\]\]/.test(line)) {
      current = { for: undefined, csps: [] };
      blocks.push(current);
      continue;
    }
    // Any other array-of-tables header closes the current [[headers]] block;
    // its own sub-tables (`[headers.values]`) keep it open.
    if (/^\[\[/.test(line) || (/^\[/.test(line) && !/^\[\s*headers\./.test(line))) {
      current = undefined;
      continue;
    }
    if (!current) continue;
    const forMatch = line.match(/^for\s*=\s*"([^"]*)"/);
    if (forMatch) current.for = forMatch[1];
    const cspMatch = line.match(/^"?Content-Security-Policy"?\s*=\s*"([^"]*)"/);
    if (cspMatch) current.csps.push(cspMatch[1]);
  }

  const csps = blocks.filter((block) => block.for === '/*').flatMap((block) => block.csps);
  if (csps.length === 0) {
    return {
      csp: undefined,
      errors: [error('a', 'netlify.toml has no Content-Security-Policy header for "/*".')],
    };
  }
  if (csps.length > 1) {
    return {
      csp: undefined,
      errors: [error('a', `netlify.toml has ${csps.length} Content-Security-Policy headers for "/*"; expected exactly one.`)],
    };
  }
  return { csp: csps[0], errors: [] };
}

export function cspHashes(toml) {
  const { csp, errors } = cspFromToml(toml);
  if (csp === undefined) return { hashes: new Set(), errors };
  if (/script-src[^;]*'unsafe-inline'/.test(csp)) {
    errors.push(error('a', "CSP script-src must not use 'unsafe-inline'."));
  }
  return { hashes: new Set(csp.match(/sha256-[A-Za-z0-9+/=]+/g) ?? []), errors };
}

// ---------- checks ----------

export function checkCspHashes(pages, toml) {
  const { hashes: allowed, errors } = cspHashes(toml);
  const used = new Map(); // hash -> files that contain the script
  for (const { file, html } of pages) {
    for (const body of inlineExecutableScripts(html)) {
      const hash = sha256(body);
      used.set(hash, [...(used.get(hash) ?? []), file]);
    }
  }
  for (const [hash, files] of used) {
    if (!allowed.has(hash)) {
      errors.push(error('a', `inline script '${hash}' (in ${files.join(', ')}) is not in netlify.toml CSP script-src.`));
    }
  }
  for (const hash of allowed) {
    if (!used.has(hash)) errors.push(error('a', `netlify.toml CSP has stale hash '${hash}' (no inline script uses it).`));
  }
  return errors;
}

export function checkAnchors(pages, homeIds) {
  const errors = [];
  for (const { file, html } of pages) {
    const pageIds = idsIn(html);
    for (const [, path, id] of html.matchAll(/href="(\/?)#([^"]+)"/g)) {
      // `/#id` targets the home page; a bare `#id` targets the current page.
      const ids = path === '/' ? homeIds : pageIds;
      if (!ids.has(id)) errors.push(error('b', `${file}: link to '${path}#${id}' has no matching id.`));
    }
  }
  return errors;
}

// `exists(relPath)` answers whether a file exists relative to dist/.
export function checkProjectLinks(pages, exists) {
  const errors = [];
  for (const { file, html } of pages) {
    for (const [, slug] of html.matchAll(/href="\/proyectos\/([^"/#?]+)\/?"/g)) {
      if (!exists(join('proyectos', slug, 'index.html'))) {
        errors.push(error('c', `${file}: link to /proyectos/${slug}/ has no built page.`));
      }
    }
  }
  return errors;
}

// The home `#projects` section must list at least one project card; an empty
// `featured` set would otherwise ship an empty section with a green build.
export function checkFeaturedProjects(homeHtml) {
  const section = homeHtml.match(/<section\b[^>]*\sid="projects"[^>]*>([\s\S]*?)<\/section>/);
  if (!section) return [error('c', 'dist/index.html has no <section id="projects">.')];
  if (!/href="\/proyectos\/[^"/#?]+\/"/.test(section[1])) {
    return [error('c', 'dist/index.html #projects lists no /proyectos/<slug>/ card (no featured project?).')];
  }
  return [];
}

function isWrappedInLabel(formHtml, index) {
  const before = formHtml.slice(0, index);
  return before.lastIndexOf('<label') > before.lastIndexOf('</label>');
}

export function checkContactForm(homeHtml) {
  const errors = [];
  const fail = (message) => errors.push(error('d', message));
  const match = homeHtml.match(/(<form\b[^>]*\sname="contact"[^>]*>)([\s\S]*?)<\/form>/);
  if (!match) {
    fail('dist/index.html has no <form name="contact">.');
    return errors;
  }
  const [, formTag, body] = match;
  if (getAttr(formTag, 'data-netlify') !== 'true') fail('contact form lacks data-netlify="true".');
  if (getAttr(formTag, 'netlify-honeypot') !== 'bot-field') fail('contact form lacks netlify-honeypot="bot-field".');
  if (!/<input\b[^>]*\sname="bot-field"/.test(body)) fail('contact form lacks the bot-field honeypot input.');
  if (!/<input\b(?=[^>]*\stype="hidden")(?=[^>]*\sname="form-name")(?=[^>]*\svalue="contact")[^>]*>/.test(body)) {
    fail('contact form lacks the hidden form-name="contact" input.');
  }

  const labelTargets = new Set([...body.matchAll(/<label\b[^>]*\sfor="([^"]+)"/g)].map((m) => m[1]));
  for (const control of body.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
    const tag = control[0];
    if (getAttr(tag, 'type') === 'hidden') continue;
    const id = getAttr(tag, 'id');
    const labelled = (id && labelTargets.has(id)) || isWrappedInLabel(body, control.index);
    if (!labelled) fail(`contact form control '${getAttr(tag, 'name') ?? tag}' has no <label>.`);
  }
  return errors;
}

export function checkSeo(pages, exists) {
  const errors = [];
  const fail = (message) => errors.push(error('e', message));
  for (const name of ['sitemap-index.xml', 'robots.txt']) {
    if (!exists(name)) fail(`dist/${name} is missing.`);
  }
  for (const { file, html } of pages) {
    const canonical = html.match(/<link\b[^>]*\srel="canonical"[^>]*>/);
    if (!canonical || !/^https:\/\//.test(getAttr(canonical[0], 'href') ?? '')) {
      fail(`${file}: missing absolute canonical link.`);
    }
    const ogImage = html.match(/<meta\b[^>]*\sproperty="og:image"[^>]*>/);
    const ogImageUrl = ogImage && getAttr(ogImage[0], 'content');
    if (!ogImageUrl || !/^https:\/\//.test(ogImageUrl)) {
      fail(`${file}: missing absolute og:image.`);
    } else if (!exists(decodeURIComponent(new URL(ogImageUrl).pathname).replace(/^\/+/, ''))) {
      fail(`${file}: og:image '${ogImageUrl}' is not in dist.`);
    }
  }
  return errors;
}

// Runs every check. `toml` is the netlify.toml text (or null when missing).
export function verifyDist({ pages, homeHtml, toml, exists }) {
  return [
    ...checkCspHashes(pages, toml),
    ...checkAnchors(pages, idsIn(homeHtml)),
    ...checkProjectLinks(pages, exists),
    ...checkFeaturedProjects(homeHtml),
    ...checkContactForm(homeHtml),
    ...checkSeo(pages, exists),
  ];
}

// ---------- CLI ----------

function listHtmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

function main() {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  const DIST = join(ROOT, 'dist');
  const NETLIFY_TOML = join(ROOT, 'netlify.toml');

  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('verify-dist: dist/index.html not found. Run `astro build` first.');
    process.exit(1);
  }

  const pages = listHtmlFiles(DIST).map((path) => ({
    file: relative(ROOT, path),
    html: readFileSync(path, 'utf8'),
  }));
  const errors = verifyDist({
    pages,
    homeHtml: readFileSync(join(DIST, 'index.html'), 'utf8'),
    toml: existsSync(NETLIFY_TOML) ? readFileSync(NETLIFY_TOML, 'utf8') : null,
    exists: (relPath) => existsSync(join(DIST, relPath)),
  });

  if (errors.length > 0) {
    console.error(`verify-dist: ${errors.length} problem(s) found in dist/:`);
    for (const message of errors) console.error(`  - ${message}`);
    process.exit(1);
  }

  console.log(`verify-dist: OK (${pages.length} pages; CSP hashes, anchors, project links, featured projects, contact form, SEO).`);
}

// Compare real paths: Node resolves import.meta.url through symlinks but argv[1] is not,
// so a plain URL comparison would silently skip the check in symlinked checkouts.
function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) main();
