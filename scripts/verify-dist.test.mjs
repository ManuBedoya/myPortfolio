// Tests for scripts/verify-dist.mjs (run with `npm test`).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkAnchors,
  checkContactForm,
  checkCspHashes,
  checkFeaturedProjects,
  checkProjectLinks,
  checkSeo,
  cspFromToml,
  inlineExecutableScripts,
  sha256,
  verifyDist,
} from './verify-dist.mjs';

// ---------- fixtures ----------

const FLAG_SCRIPT = "document.documentElement.classList.add('js');";
const MODULE_SCRIPT = 'const menu = document.querySelector("#menu");';
const JSON_LD = '{"@context":"https://schema.org","@type":"Person"}';

const tomlWith = (hashes, extra = '') => `[build]
  publish = "dist"

# Security headers.
[[headers]]
  for = "/*"
  [headers.values]
${extra}    Content-Security-Policy = "default-src 'self'; script-src 'self' ${hashes.map((h) => `'${h}'`).join(' ')}; object-src 'none'"
    X-Frame-Options = "DENY"

[[headers]]
  for = "/_astro/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
`;

const VALID_TOML = tomlWith([sha256(FLAG_SCRIPT), sha256(MODULE_SCRIPT)]);

const CONTACT_FORM = `<form name="contact" method="POST" action="/gracias/" data-netlify="true" netlify-honeypot="bot-field">
  <input type="hidden" name="form-name" value="contact">
  <p hidden><label>Leave empty <input name="bot-field"></label></p>
  <label for="name">Nombre</label><input id="name" name="name" type="text">
  <label for="message">Mensaje</label><textarea id="message" name="message"></textarea>
</form>`;

const homeHtml = ({ projects = ['zetta55'], form = CONTACT_FORM } = {}) => `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://example.com/">
<meta property="og:image" content="https://example.com/og-default.png">
<script>${FLAG_SCRIPT}</script>
<script type="application/ld+json">${JSON_LD}</script>
</head><body>
<nav><a href="/#projects">Proyectos</a><a href="#contact">Contacto</a></nav>
<section id="about"><p>Hola</p></section>
<section id="projects" class="py-16">
${projects.map((slug) => `<article><a href="/proyectos/${slug}/">${slug}</a></article>`).join('\n')}
</section>
<section id="contact">${form}</section>
<script type="module">${MODULE_SCRIPT}</script>
</body></html>`;

const projectHtml = `<!DOCTYPE html><html><head>
<link rel="canonical" href="https://example.com/proyectos/zetta55/">
<meta property="og:image" content="https://example.com/_astro/zetta55.jpg">
<script>${FLAG_SCRIPT}</script>
</head><body><a href="/#projects">Volver</a><script type="module">${MODULE_SCRIPT}</script></body></html>`;

const DIST_FILES = new Set([
  'index.html',
  'proyectos/zetta55/index.html',
  'sitemap-index.xml',
  'robots.txt',
  'og-default.png',
  '_astro/zetta55.jpg',
]);
const exists = (relPath) => DIST_FILES.has(relPath.split('\\').join('/'));

const validInput = (overrides = {}) => {
  const home = overrides.homeHtml ?? homeHtml();
  return {
    pages: [
      { file: 'dist/index.html', html: home },
      { file: 'dist/proyectos/zetta55/index.html', html: projectHtml },
    ],
    homeHtml: home,
    toml: VALID_TOML,
    exists,
    ...overrides,
  };
};

const hasError = (errors, pattern) =>
  assert.ok(errors.some((e) => pattern.test(e)), `expected an error matching ${pattern}, got:\n${errors.join('\n')}`);

// ---------- tests ----------

describe('verifyDist', () => {
  it('passes a valid fixture', () => {
    assert.deepEqual(verifyDist(validInput()), []);
  });
});

describe('(a) CSP hashes', () => {
  it('hashes inline scripts including type="module" and excludes application/ld+json and src scripts', () => {
    const html = `<script>${FLAG_SCRIPT}</script><script type="application/ld+json">${JSON_LD}</script>
<script type="module">${MODULE_SCRIPT}</script><script type="module" src="/_astro/a.js"></script>`;
    assert.deepEqual(inlineExecutableScripts(html), [FLAG_SCRIPT, MODULE_SCRIPT]);
  });

  it('detects an inline script missing from the CSP', () => {
    const errors = checkCspHashes(validInput().pages, tomlWith([sha256(FLAG_SCRIPT)]));
    hasError(errors, new RegExp(`^\\[a\\] inline script '${escape(sha256(MODULE_SCRIPT))}'.*not in netlify\\.toml`));
  });

  it('detects a stale CSP hash', () => {
    const stale = sha256('removed();');
    const errors = checkCspHashes(validInput().pages, tomlWith([sha256(FLAG_SCRIPT), sha256(MODULE_SCRIPT), stale]));
    assert.deepEqual(errors, [`[a] netlify.toml CSP has stale hash '${stale}' (no inline script uses it).`]);
  });

  it("rejects 'unsafe-inline' in script-src", () => {
    const toml = VALID_TOML.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    hasError(checkCspHashes(validInput().pages, toml), /unsafe-inline/);
  });

  it('reports a missing netlify.toml', () => {
    assert.deepEqual(checkCspHashes([], null), ['[a] netlify.toml is missing.']);
  });

  it('ignores a commented-out CSP line', () => {
    const commented = `    # Content-Security-Policy = "script-src 'self' 'sha256-OLD='"\n`;
    const { csp, errors } = cspFromToml(tomlWith([sha256(FLAG_SCRIPT)], commented));
    assert.deepEqual(errors, []);
    assert.ok(csp.includes(sha256(FLAG_SCRIPT)));
    assert.ok(!csp.includes('sha256-OLD='));
  });

  it('only reads the CSP from the for = "/*" headers block', () => {
    const toml = `[[headers]]
  for = "/_astro/*"
  [headers.values]
    Content-Security-Policy = "script-src 'sha256-OTHER='"
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "script-src 'self' '${sha256(FLAG_SCRIPT)}'"
`;
    const { csp, errors } = cspFromToml(toml);
    assert.deepEqual(errors, []);
    assert.ok(csp.includes(sha256(FLAG_SCRIPT)));
  });

  it('fails when the /* block has no CSP', () => {
    const toml = `[[headers]]
  for = "/_astro/*"
  [headers.values]
    Content-Security-Policy = "script-src 'sha256-OTHER='"
`;
    const { csp, errors } = cspFromToml(toml);
    assert.equal(csp, undefined);
    hasError(errors, /no Content-Security-Policy header for "\/\*"/);
  });

  it('rejects more than one CSP for /*', () => {
    const duplicate = `    Content-Security-Policy = "script-src 'self'"\n`;
    const { csp, errors } = cspFromToml(tomlWith([sha256(FLAG_SCRIPT)], duplicate));
    assert.equal(csp, undefined);
    hasError(errors, /2 Content-Security-Policy headers for "\/\*"/);
  });
});

describe('(b) anchors', () => {
  it('detects a broken home anchor and a broken same-page anchor', () => {
    const home = homeHtml();
    const page = { file: 'dist/x/index.html', html: '<a href="/#nope">x</a><a href="#missing">y</a>' };
    const errors = checkAnchors([page], new Set(['projects']));
    assert.deepEqual(errors, [
      "[b] dist/x/index.html: link to '/#nope' has no matching id.",
      "[b] dist/x/index.html: link to '#missing' has no matching id.",
    ]);
    assert.deepEqual(checkAnchors([{ file: 'dist/index.html', html: home }], new Set(['projects'])), []);
  });
});

describe('(c) project pages', () => {
  it('detects a link to a project page that was not built', () => {
    const page = { file: 'dist/index.html', html: '<a href="/proyectos/ghost/">x</a>' };
    assert.deepEqual(checkProjectLinks([page], exists), [
      '[c] dist/index.html: link to /proyectos/ghost/ has no built page.',
    ]);
  });

  it('detects a home page with zero featured project cards', () => {
    const errors = checkFeaturedProjects(homeHtml({ projects: [] }));
    hasError(errors, /#projects lists no \/proyectos\/<slug>\/ card/);
  });

  it('ignores project links outside the #projects section', () => {
    const home = homeHtml({ projects: [] }).replace('<nav>', '<nav><a href="/proyectos/zetta55/">z</a>');
    hasError(checkFeaturedProjects(home), /#projects lists no/);
  });

  it('detects a home page without a #projects section', () => {
    hasError(checkFeaturedProjects('<html><body></body></html>'), /no <section id="projects">/);
  });

  it('accepts a #projects section with at least one card', () => {
    assert.deepEqual(checkFeaturedProjects(homeHtml()), []);
  });

  it('fails verifyDist when no project is featured', () => {
    hasError(verifyDist(validInput({ homeHtml: homeHtml({ projects: [] }) })), /#projects lists no/);
  });
});

describe('(d) contact form', () => {
  it('detects a missing data-netlify attribute', () => {
    const form = CONTACT_FORM.replace(' data-netlify="true"', '');
    assert.deepEqual(checkContactForm(homeHtml({ form })), ['[d] contact form lacks data-netlify="true".']);
  });

  it('detects a missing honeypot', () => {
    const form = CONTACT_FORM.replace(' netlify-honeypot="bot-field"', '').replace(
      '<p hidden><label>Leave empty <input name="bot-field"></label></p>',
      '',
    );
    assert.deepEqual(checkContactForm(homeHtml({ form })), [
      '[d] contact form lacks netlify-honeypot="bot-field".',
      '[d] contact form lacks the bot-field honeypot input.',
    ]);
  });

  it('detects a missing form-name input', () => {
    const form = CONTACT_FORM.replace('<input type="hidden" name="form-name" value="contact">', '');
    assert.deepEqual(checkContactForm(homeHtml({ form })), ['[d] contact form lacks the hidden form-name="contact" input.']);
  });

  it('detects a control without a label', () => {
    const form = CONTACT_FORM.replace('<label for="name">Nombre</label>', '');
    assert.deepEqual(checkContactForm(homeHtml({ form })), ["[d] contact form control 'name' has no <label>."]);
  });

  it('detects a missing form', () => {
    assert.deepEqual(checkContactForm(homeHtml({ form: '' })), ['[d] dist/index.html has no <form name="contact">.']);
  });
});

describe('(e) SEO', () => {
  it('detects missing sitemap, canonical and og:image', () => {
    const page = { file: 'dist/a/index.html', html: '<html><head></head></html>' };
    const errors = checkSeo([page], (p) => p === 'robots.txt');
    assert.deepEqual(errors, [
      '[e] dist/sitemap-index.xml is missing.',
      '[e] dist/a/index.html: missing absolute canonical link.',
      '[e] dist/a/index.html: missing absolute og:image.',
    ]);
  });

  it('detects an og:image that is not in dist', () => {
    const html = projectHtml.replace('zetta55.jpg', 'gone.jpg');
    hasError(checkSeo([{ file: 'p.html', html }], exists), /og:image 'https:\/\/example\.com\/_astro\/gone\.jpg' is not in dist/);
  });
});

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
