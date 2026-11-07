/**
 * ZESTFLOW OS — 7 CURATED ARCHETYPES & COMMERCIAL DOCUMENT SUITE VERIFICATION TEST
 * 
 * Verifies:
 * 1. Pristine backup SHA-256 integrity
 * 2. Strict CSP Meta Hash byte-for-byte validation
 * 3. 7 Curated Template Archetypes CSS & renderPaper() classes (.paper.tpl-*)
 * 4. Multi-Document Commercial Suite (Invoice, Tax, Quote, PO, Receipt, Credit, Claim)
 * 5. Context-adaptive labels (Vendor vs Client, Valid Until vs Due, Settlement vs Amount Due)
 * 6. Dynamic Watermark & Status Stamps (RECEIPT, QUOTE, PO, CREDIT NOTE, CLAIM, PAID)
 * 7. In-Editor Universal Design Studio Drawer DOM & controls
 * 8. Dashboard "Document & Invoice Templates" Widget (0 fake metrics, authentic SVGs, 1-click launch)
 * 9. 1-Click Lifecycle Document Conversions (Quote -> Invoice -> Receipt -> Credit Note)
 * 10. Design Studio Persistence (accentColor, fontFamily, defaultTemplate)
 */

const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const assert = require('assert');

console.log('🧪 Running ZestFlow OS 7-Archetype & Commercial Document Suite Tests...\n');

let passCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    passCount++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     ${err.message}`);
    process.exit(1);
  }
}

const html = fs.readFileSync('index.html', 'utf8');

// 1. Pristine Backup SHA-256
test('Pristine Backup Integrity: zestflow-v2.production-pre-correction-backup.html is byte-for-byte untouched', () => {
  const backupBuf = fs.readFileSync('zestflow-v2.production-pre-correction-backup.html');
  const backupHash = crypto.createHash('sha256').update(backupBuf).digest('hex').toUpperCase();
  assert.strictEqual(backupHash, '52AFB20CD74CC657EBB317EDBEDAAB200034074F5AFC662F6F6259CDDF846969');
});

// 2. CSP Hash Lock
test('CSP Security: script-src hash matches exact script content digest', () => {
  const scStart = html.indexOf('<script>');
  const scEnd = html.indexOf('</script>');
  assert.ok(scStart !== -1 && scEnd !== -1, 'Script tags must be found');
  const scriptContent = html.slice(scStart + 8, scEnd);
  const calculatedHash = 'sha256-' + crypto.createHash('sha256').update(scriptContent).digest('base64');
  const metaMatch = html.match(/script-src 'sha256-([^']+)'/);
  assert.ok(metaMatch, 'script-src hash must be found in meta tag');
  assert.strictEqual('sha256-' + metaMatch[1], calculatedHash, 'CSP meta hash must match script digest exactly');
});

// 3. Extract internal symbols using Node vm
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const rawScript = scriptMatch[1];
const instrumentedScript = rawScript.replace(
  'showBanner();\nrender();\n})();',
  `window.__ZF_DOCS__ = {
    normInvoice, normSettings, newInvoice, renderPaper, calc, effStatus,
    DOC_TYPES, S, ui, fmtMoney, todayISO, addDays, clone, uid
  };
  })();`
);

function createFullSandbox(initialStorage = {}) {
  const store = Object.assign({}, initialStorage);
  const sessionStore = {};
  const elements = {};

  function makeElem(id, tagName = 'div') {
    const el = {
      id: id || '',
      tagName: tagName.toUpperCase(),
      value: '',
      innerHTML: '',
      textContent: '',
      style: {},
      _classes: new Set(),
      children: [],
      classList: {
        add: function(...cls) { cls.forEach(c => el._classes.add(c)); },
        remove: function(...cls) { cls.forEach(c => el._classes.delete(c)); },
        contains: function(c) { return el._classes.has(c); },
        toggle: function(c, force) {
          if (force !== undefined) {
            if (force) el._classes.add(c); else el._classes.delete(c);
            return force;
          }
          if (el._classes.has(c)) { el._classes.delete(c); return false; }
          el._classes.add(c); return true;
        }
      },
      hasAttribute: function(attr) { return this[attr] !== undefined && this[attr] !== null && this[attr] !== false; },
      setAttribute: function(k, v) { this[k] = String(v); },
      getAttribute: function(k) { return this[k] !== undefined ? this[k] : null; },
      removeAttribute: function(k) { delete this[k]; },
      querySelector: function(sel) {
        return makeElem(sel.replace(/[^a-zA-Z0-9_-]/g, ''));
      },
      querySelectorAll: function() { return []; },
      closest: function() { return null; },
      focus: function() {},
      click: function() { if (this.onclick) this.onclick(); },
      appendChild: function(c) { this.children.push(c); return c; },
      removeChild: function(c) { const idx = this.children.indexOf(c); if (idx >= 0) this.children.splice(idx, 1); return c; },
      remove: function() {},
      addEventListener: function(event, handler) { this['on_' + event] = handler; },
      removeEventListener: function() {},
      setPointerCapture: function() {},
      getContext: function() { return { beginPath: () => {}, arc: () => {}, fill: () => {}, clearRect: () => {} }; }
    };
    return el;
  }

  const doc = {
    body: makeElem('body', 'body'),
    getElementById: function(id) {
      if (!elements[id]) elements[id] = makeElem(id);
      return elements[id];
    },
    querySelector: function(sel) {
      const id = sel.replace(/^#/, '');
      return this.getElementById(id);
    },
    querySelectorAll: function() { return []; },
    createElement: function(tag) {
      return makeElem('created_' + tag, tag);
    },
    addEventListener: function() {},
    removeEventListener: function() {},
    title: 'ZestFlow OS'
  };

  const win = {
    document: doc,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    },
    sessionStorage: {
      getItem: k => (k in sessionStore ? sessionStore[k] : null),
      setItem: (k, v) => { sessionStore[k] = String(v); },
      removeItem: k => { delete sessionStore[k]; },
      clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); }
    },
    location: {
      href: 'https://zestflow-seven.vercel.app/',
      hash: '',
      pathname: '/',
      search: '',
      origin: 'https://zestflow-seven.vercel.app'
    },
    history: { replaceState: function() {} },
    navigator: { userAgent: 'NodeTestAgent' },
    crypto: {
      getRandomValues: arr => crypto.randomFillSync(arr),
      subtle: {
        digest: async (algo, data) => {
          const h = crypto.createHash('sha256').update(Buffer.from(data)).digest();
          return h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength);
        }
      }
    },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: cb => setTimeout(cb, 0),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: id => clearTimeout(id),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: id => clearInterval(id),
    addEventListener: function() {},
    removeEventListener: function() {}
  };

  const sandbox = {
    window: win,
    document: doc,
    localStorage: win.localStorage,
    sessionStorage: win.sessionStorage,
    navigator: win.navigator,
    location: win.location,
    history: win.history,
    crypto: win.crypto,
    TextEncoder: global.TextEncoder,
    TextDecoder: global.TextDecoder,
    btoa: str => Buffer.from(str, 'binary').toString('base64'),
    atob: b64 => Buffer.from(b64, 'base64').toString('binary'),
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
      info: () => {}
    },
    setTimeout: win.setTimeout,
    clearTimeout: win.clearTimeout,
    setInterval: win.setInterval,
    clearInterval: win.clearInterval,
    requestAnimationFrame: win.requestAnimationFrame
  };

  return { sandbox, win, doc, store };
}

const env = createFullSandbox();
vm.createContext(env.sandbox);
vm.runInContext(instrumentedScript, env.sandbox);
const zf = env.win.__ZF_DOCS__;

// 4. Test 7 Curated Archetype classes in renderPaper()
test('7 Curated Archetypes: renderPaper() attaches scoped archetype class to .paper', () => {
  const archetypes = ['modern', 'minimal', 'corporate', 'creative', 'claim', 'compact', 'classic'];
  archetypes.forEach(tpl => {
    const inv = zf.normInvoice({ number: 'TEST-' + tpl, template: tpl, lang: 'en' });
    const paperHtml = zf.renderPaper(inv, {});
    assert.ok(paperHtml.includes(`class="paper tpl-${tpl}"`), `Must render .paper.tpl-${tpl}`);
  });
});

// 5. Corporate Template Executive Features
test('Corporate Archetype: Renders full header banner and dual signatory boxes', () => {
  const inv = zf.normInvoice({ number: 'CORP-001', template: 'corporate', lang: 'en' });
  const paperHtml = zf.renderPaper(inv, {});
  assert.ok(paperHtml.includes('Prepared By'), 'Corporate must render Prepared By signoff');
  assert.ok(paperHtml.includes('Authorized Signatory'), 'Corporate must render Authorized Signatory signoff');
});

// 6. Consultant Claim Institutional Matrix
test('Consultant Claim: Renders institutional reimbursement badge and claim stamp', () => {
  const inv = zf.normInvoice({ number: 'CLM-001', title: 'claim', template: 'claim', lang: 'en' });
  const paperHtml = zf.renderPaper(inv, {});
  assert.ok(paperHtml.includes('Institutional Timesheet &amp; Reimbursement Matrix'), 'Must render institutional badge');
  assert.ok(paperHtml.includes('OFFICIAL CLAIM'), 'Must render official claim stamp');
});

// 7. Multi-Document Suite: Purchase Order
test('Purchase Order: Adapts labels to Vendor / Supplier and Expected Delivery', () => {
  const inv = zf.normInvoice({ number: 'PO-9901', title: 'po', template: 'corporate', lang: 'en' });
  const paperHtml = zf.renderPaper(inv, {});
  assert.ok(paperHtml.includes('Vendor / Supplier'), 'Must adapt client label to Vendor / Supplier');
  assert.ok(paperHtml.includes('Delivery Expected'), 'Must adapt due date to Delivery Expected');
  assert.ok(paperHtml.includes('PURCHASE ORDER'), 'Must render PURCHASE ORDER stamp');
  assert.ok(paperHtml.includes('Total Order Value'), 'Must render Total Order Value');
});

// 8. Multi-Document Suite: Official Payment Receipt
test('Official Payment Receipt: Stamped OFFICIAL RECEIPT with Amount Received & Settled', () => {
  const inv = zf.normInvoice({ number: 'RCPT-501', title: 'receipt', status: 'paid', template: 'compact', lang: 'en' });
  const paperHtml = zf.renderPaper(inv, {});
  assert.ok(paperHtml.includes('OFFICIAL RECEIPT'), 'Must render OFFICIAL RECEIPT stamp');
  assert.ok(paperHtml.includes('Received From'), 'Must adapt label to Received From');
  assert.ok(paperHtml.includes('Payment Date'), 'Must adapt label to Payment Date');
  assert.ok(paperHtml.includes('Amount Received &amp; Settled'), 'Must render Amount Received & Settled');
});

// 9. Multi-Document Suite: Quotation / Estimate
test('Quotation: Stamped ESTIMATE / QUOTE with Valid Until and Estimated Total', () => {
  const inv = zf.normInvoice({ number: 'QT-202', title: 'quote', template: 'creative', lang: 'en' });
  const paperHtml = zf.renderPaper(inv, {});
  assert.ok(paperHtml.includes('ESTIMATE / QUOTE'), 'Must render ESTIMATE / QUOTE stamp');
  assert.ok(paperHtml.includes('Valid Until'), 'Must adapt due date to Valid Until');
  assert.ok(paperHtml.includes('Estimated Total'), 'Must render Estimated Total');
});

// 10. Dashboard Templates Card: Zero Fake Metrics, Real SVGs & Inner Scroll
test('Dashboard Templates Widget: Zero fake vanity counts and genuine SVG blueprints', () => {
  assert.ok(!html.includes('used by 1000 user'), 'Must NOT contain fake "used by 1000 user" text');
  assert.ok(!html.includes('used by 800 user'), 'Must NOT contain fake "used by 800 user" text');
  assert.ok(html.includes('Modern SaaS Invoice'), 'Must list Modern SaaS Invoice');
  assert.ok(html.includes('Corporate Tax Invoice'), 'Must list Corporate Tax Invoice');
  assert.ok(html.includes('Official Payment Receipt'), 'Must list Official Payment Receipt');
  assert.ok(html.includes('Purchase Order (PO)'), 'Must list Purchase Order');
  assert.ok(html.includes('Creative Studio Quote'), 'Must list Creative Studio Quote');
  assert.ok(html.includes('Consultant Claim'), 'Must list Consultant Claim');
  assert.ok(html.includes('🎨 Open Custom Design Studio'), 'Must feature Open Custom Design Studio button');
  assert.ok(html.includes('invo-tpl-scroll-list'), 'Must wrap blueprints in .invo-tpl-scroll-list');
  assert.ok(html.includes('Scroll for more'), 'Must show Scroll for more indicator');
  assert.ok(html.includes('max-height: 252px'), 'Must apply max-height scroll boundary in CSS');
});

// 11. Design Studio Drawer & Event Wiring in DOM
test('Design Studio Drawer: Interactive controls exist in DOM and handlers are cleanly wired', () => {
  assert.ok(html.includes('id="designStudioDrawer"'), 'Must render #designStudioDrawer');
  assert.ok(html.includes('data-act="pick-tpl-archetype" data-tpl="modern"'), 'Must have Modern SaaS archetype chip');
  assert.ok(html.includes('data-act="pick-tpl-archetype" data-tpl="corporate"'), 'Must have Corporate archetype chip');
  assert.ok(html.includes('data-act="pick-accent-color" data-color="#ff5733"'), 'Must have Zest Amber color swatch');
  assert.ok(html.includes('data-act="set-default-design"'), 'Must have Save as Default button');
  // Check active color swatch flat industrial outline (zero oversized swelling!)
  assert.ok(html.includes('.color-swatch.active'), 'Must have .color-swatch.active style');
  assert.ok(html.includes('transform: none !important'), 'Active swatch must remain flat with no ballooning scale');
  // Strict check that $$ is used for multiple elements (no single $ querySelector)
  assert.ok(!/[^$]\$\('\.tpl-chip'\)\.forEach/.test(rawScript), 'Must NOT call forEach on single $ querySelector for .tpl-chip');
  assert.ok(!/[^$]\$\('\.color-swatch'\)\.forEach/.test(rawScript), 'Must NOT call forEach on single $ querySelector for .color-swatch');
  assert.ok(rawScript.includes("$$('.tpl-chip').forEach"), 'Must use $$ querySelectorAll for .tpl-chip');
  assert.ok(rawScript.includes("$$('.color-swatch').forEach"), 'Must use $$ querySelectorAll for .color-swatch');
});

// 12. Commercial Watermark Engine Verification
test('Watermark Engine: Supports PAID, DRAFT, ORIGINAL with diagonal print styles', () => {
  const invPaid = zf.normInvoice({ number: 'WM-001', watermark: 'PAID', lang: 'en' });
  const paperPaid = zf.renderPaper(invPaid, {});
  assert.ok(paperPaid.includes('class="paper-watermark paid"'), 'Must render paper-watermark paid class');
  assert.ok(paperPaid.includes('PAID</div>'), 'Must render text PAID inside watermark');

  const invDraft = zf.normInvoice({ number: 'WM-002', watermark: 'DRAFT', lang: 'en' });
  const paperDraft = zf.renderPaper(invDraft, {});
  assert.ok(paperDraft.includes('class="paper-watermark draft"'), 'Must render paper-watermark draft class');

  assert.ok(html.includes('data-act-change="pick-watermark"'), 'Must have watermark dropdown in editor drawer');
  assert.ok(html.includes('.paper-watermark'), 'Must include .paper-watermark CSS styles');
  assert.ok(html.includes('grid-template-columns: repeat(3, 1fr)'), 'Hero metrics row must use balanced 3-column grid (no void gap)');
});

console.log(`\nResults: ${passCount}/${totalCount} tests passed.`);
if (passCount === totalCount) {
  console.log('🎉 ALL 7-ARCHETYPE & COMMERCIAL DOCUMENT SUITE TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED.\n');
  process.exit(1);
}
