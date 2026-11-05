/**
 * test_typography_google_sans_flex.js
 * Verification suite for Google Sans Flex Typography System in ZestFlow OS
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🔤 Running ZestFlow OS Google Sans Flex Typography Verification...\n');

let passCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// 1. Package Installation
test('Font Package: @fontsource-variable/google-sans-flex is installed in package.json and node_modules', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.dependencies && pkg.dependencies['@fontsource-variable/google-sans-flex'], 'Must be listed in dependencies');
  assert.ok(fs.existsSync('node_modules/@fontsource-variable/google-sans-flex/metadata.json'), 'metadata.json must exist');
  assert.ok(fs.existsSync('node_modules/@fontsource-variable/google-sans-flex/index.css'), 'index.css must exist');
});

// 2. Self-Hosted Asset Verification
test('Self-Hosting: woff2 font files exist under assets/fonts/ with valid byte sizes', () => {
  const latinPath = path.join('assets', 'fonts', 'google-sans-flex-latin-wght-normal.woff2');
  const latinExtPath = path.join('assets', 'fonts', 'google-sans-flex-latin-ext-wght-normal.woff2');
  assert.ok(fs.existsSync(latinPath), 'Latin woff2 must exist');
  assert.ok(fs.existsSync(latinExtPath), 'Latin-ext woff2 must exist');
  const latinStat = fs.statSync(latinPath);
  const latinExtStat = fs.statSync(latinExtPath);
  assert.ok(latinStat.size > 20000, 'Latin font must be genuine woff2');
  assert.ok(latinExtStat.size > 10000, 'Latin-ext font must be genuine woff2');
});

// 3. HTML & CSS Configuration
const html = fs.readFileSync('index.html', 'utf8');

test('Preload & CSP: Preloads Latin variable font and CSP font-src includes \'self\'', () => {
  assert.ok(html.includes('<link rel="preload" href="assets/fonts/google-sans-flex-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>'), 'Must preload latin woff2');
  const cspMatch = html.match(/<meta[^>]*Content-Security-Policy[^>]*content="([^"]*)"/i);
  assert.ok(cspMatch, 'CSP meta tag must exist');
  const csp = cspMatch[1];
  assert.ok(csp.includes("font-src 'self'"), 'CSP font-src must include \'self\' for local font loading');
});

test('@font-face Rules: Google Sans Flex and Google Sans Flex Variable declarations are active', () => {
  assert.ok(html.includes("font-family: 'Google Sans Flex'"), '@font-face for Google Sans Flex must exist');
  assert.ok(html.includes("font-family: 'Google Sans Flex Variable'"), '@font-face for Google Sans Flex Variable must exist');
  assert.ok(html.includes("font-weight: 1 1000"), 'Must support variable weights 1 to 1000');
  assert.ok(html.includes("font-display: swap"), 'Must declare font-display: swap');
});

test('Typography Stack: --ui has Google Sans Flex as the primary Latin font', () => {
  const rootMatch = html.match(/--ui:\s*([^;]+);/);
  assert.ok(rootMatch, '--ui variable must exist in :root');
  const stack = rootMatch[1];
  assert.ok(stack.startsWith("'Google Sans Flex'"), '--ui stack must prioritize Google Sans Flex first');
  assert.ok(stack.includes("'Noto Sans Arabic'"), '--ui stack must preserve Noto Sans Arabic fallback');
  assert.ok(stack.includes("'Noto Nastaliq Urdu'"), '--ui stack must preserve Noto Nastaliq Urdu fallback');
  assert.ok(stack.includes("'Noto Sans Telugu'"), '--ui stack must preserve Noto Sans Telugu fallback');
});

test('Multilingual Preservation: Paper invoice and portal preserve Arabic, Urdu, Telugu precedence', () => {
  assert.ok(html.includes(".paper[lang=ar]{font-family:'Noto Sans Arabic','Google Sans Flex'"), 'Arabic paper must lead with Noto Sans Arabic');
  assert.ok(html.includes(".paper[lang=ur]{font-family:'Noto Nastaliq Urdu','Noto Sans Arabic','Google Sans Flex'"), 'Urdu paper must lead with Noto Nastaliq Urdu');
  assert.ok(html.includes(".paper[lang=te]{font-family:'Noto Sans Telugu','Google Sans Flex'"), 'Telugu paper must lead with Noto Sans Telugu');
  assert.ok(html.includes("font-family:monospace"), 'Code / technical identifiers must preserve monospace');
});

// 4. Server MIME Types
test('Server Config: server.js serves .woff2 with font/woff2 MIME type', () => {
  const serverJs = fs.readFileSync('server.js', 'utf8');
  assert.ok(serverJs.includes("'.woff2': 'font/woff2'"), 'server.js must define .woff2 MIME type');
  assert.ok(serverJs.includes("'.woff': 'font/woff'"), 'server.js must define .woff MIME type');
});

console.log(`\nResults: ${passCount}/${totalCount} tests passed.`);
if (passCount === totalCount) {
  console.log('🎉 ALL GOOGLE SANS FLEX TYPOGRAPHY TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('💥 SOME TYPOGRAPHY TESTS FAILED.\n');
  process.exit(1);
}
