/**
 * test_typography_industrial_system.js
 * Verification suite for Industrial Antigravity/Linear-Grade Typography System in ZestFlow OS
 */

const fs = require('fs');
const assert = require('assert');

console.log('🔤 Running ZestFlow OS Industrial Typography Verification (Inter / SF Pro / Tabular Nums)...\n');

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

const html = fs.readFileSync('index.html', 'utf8');

// 1. Google Fonts / Typography Link
test('Font Links: Inter and Multilingual font families linked cleanly', () => {
  assert.ok(html.includes('family=Inter:wght@400;500;600;700'), 'Inter font weights 400-700 linked');
  assert.ok(html.includes('family=Noto+Sans+Arabic'), 'Noto Sans Arabic linked');
  assert.ok(html.includes('family=Noto+Nastaliq+Urdu'), 'Noto Nastaliq Urdu linked');
  assert.ok(html.includes('family=Noto+Sans+Telugu'), 'Noto Sans Telugu linked');
});

// 2. CSP Font Directive
test('CSP Font Security: font-src allows self, fonts.gstatic.com and data:', () => {
  const cspMatch = html.match(/<meta[^>]*Content-Security-Policy[^>]*content="([^"]*)"/i);
  assert.ok(cspMatch, 'CSP meta tag must exist');
  const csp = cspMatch[1];
  assert.ok(csp.includes("font-src 'self' https://fonts.gstatic.com data:"), 'CSP font-src properly constrained');
});

// 3. UI Font Stack
test('Typography Stack: --ui leads with Inter and SF Pro Apple system stack', () => {
  const rootMatch = html.match(/--ui:\s*([^;]+);/);
  assert.ok(rootMatch, '--ui variable must exist in :root');
  const stack = rootMatch[1];
  assert.ok(stack.startsWith('"Inter"'), '--ui stack must prioritize Inter first');
  assert.ok(stack.includes('"SF Pro Display"'), '--ui stack must include Apple SF Pro Display');
  assert.ok(stack.includes("'Noto Sans Arabic'"), '--ui stack must preserve Noto Sans Arabic fallback');
  assert.ok(stack.includes("'Noto Nastaliq Urdu'"), '--ui stack must preserve Noto Nastaliq Urdu fallback');
  assert.ok(stack.includes("'Noto Sans Telugu'"), '--ui stack must preserve Noto Sans Telugu fallback');
});

// 4. Industrial Text Metrics & Tracking
test('Industrial Micro-Typography: tabular-nums and negative tracking applied on body and headings', () => {
  assert.ok(html.includes('font-variant-numeric:tabular-nums;'), 'body must enforce tabular-nums for numeric alignment');
  assert.ok(html.includes('letter-spacing:-0.011em;'), 'body must enforce crisp -0.011em tracking');
  assert.ok(html.includes('letter-spacing:-.025em'), 'headings must have crisp -0.025em tracking');
  assert.ok(html.includes('font-weight:600'), 'headings must use refined 600 weight instead of clumsy 700');
});

// 5. Multilingual Invoices & Portal
test('Multilingual Preservation: Paper invoice and portal preserve native Indic/Arabic typography', () => {
  assert.ok(html.includes(".paper[lang=ar]{font-family:'Noto Sans Arabic','Inter'"), 'Arabic paper must lead with Noto Sans Arabic');
  assert.ok(html.includes(".paper[lang=ur]{font-family:'Noto Nastaliq Urdu','Noto Sans Arabic','Inter'"), 'Urdu paper must lead with Noto Nastaliq Urdu');
  assert.ok(html.includes(".paper[lang=te]{font-family:'Noto Sans Telugu','Inter'"), 'Telugu paper must lead with Noto Sans Telugu');
  assert.ok(html.includes("font-family:monospace"), 'Code / technical metrics preserve monospace');
});

console.log(`\nResults: ${passCount}/${totalCount} tests passed.`);
if (passCount === totalCount) {
  console.log('🎉 ALL INDUSTRIAL TYPOGRAPHY TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('💥 SOME TYPOGRAPHY TESTS FAILED.\n');
  process.exit(1);
}
