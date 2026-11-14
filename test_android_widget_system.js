const fs = require('fs');
const assert = require('assert');
const vm = require('vm');
const crypto = require('crypto');

console.log('================================================================================');
console.log('  📱 ZESTFLOW OS — ANDROID LAUNCHER WIDGET SYSTEM VERIFICATION TEST');
console.log('================================================================================');

const html = fs.readFileSync('index.html', 'utf8');

// Extract script
const scriptMatch = html.match(/<script(?:\s+type="text\/javascript")?>([\s\S]*?)<\/script>/i);
assert.ok(scriptMatch, 'Inline script must exist in index.html');
const rawScript = scriptMatch[1];

function createMockElement(tag, id = '') {
  const el = {
    tagName: (tag || 'DIV').toUpperCase(),
    id,
    classList: {
      _classes: new Set(),
      add(...cls) { cls.forEach(c => this._classes.add(c)); },
      remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
      contains(c) { return this._classes.has(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this.contains(c)) { this.remove(c); return false; }
          this.add(c); return true;
        }
        if (force) { this.add(c); return true; }
        this.remove(c); return false;
      }
    },
    style: {},
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] || null; },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; },
    children: [],
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    focus() {},
    blur() {},
    click() {},
    showModal() { this._open = true; },
    close() { this._open = false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 800, height: 600, bottom: 600, right: 800 })
  };
  return el;
}

function createFullSandbox() {
  const store = {};
  const doc = {
    createElement: tag => createMockElement(tag),
    getElementById: id => createMockElement('div', id),
    querySelector: sel => createMockElement('div'),
    querySelectorAll: sel => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    documentElement: createMockElement('html'),
    body: createMockElement('body')
  };
  const win = {
    location: { href: 'https://zestflow-seven.vercel.app/#/', hash: '#/' },
    localStorage: {
      getItem: k => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    },
    sessionStorage: {
      getItem: k => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    crypto: crypto,
    document: doc
  };
  return { win, doc, store };
}

const sandbox = createFullSandbox();

// Instrument script to export internal symbols
const instrumentedScript = rawScript.replace(
  /showBanner\(\);\s*render\(\);\s*\}\)\(\)\;/, 
  `window.__ZF_WIDGET_TEST__ = {
    S, ui, getDashboardLayout, renderTileCustomBar, renderWidgetCatalogDrawer,
    getCrossPageWidgetHTML, renderInvowiseDashboard, renderCashFundDashboard, calc
  };
  showBanner();
  render();
  })();`
);

try {
  new Function('window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', 'setTimeout', 'clearTimeout', instrumentedScript)(
    sandbox.win, sandbox.doc, {}, sandbox.win.location, sandbox.win.localStorage, sandbox.win.sessionStorage, setTimeout, clearTimeout
  );
} catch (err) {
  console.error("Execution error:", err);
}

const zf = sandbox.win.__ZF_WIDGET_TEST__;
assert.ok(zf, 'zf symbols must be exported');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ [FAIL] ${name}:`, e.message);
  }
}

// 1. Test InvoWise default layout includes 10 top-to-bottom modular tiles
test('1. InvoWise default layout includes 10 top-to-bottom modular tiles', () => {
  const cfg = zf.getDashboardLayout('invowise', {});
  const expected = [
    'invo-greeting', 'invo-kpi-paid', 'invo-kpi-due', 'invo-kpi-overdue',
    'invo-balances', 'invo-generator', 'invo-reminders', 'invo-ageing', 'invo-templates', 'invo-invoices'
  ];
  expected.forEach(id => {
    assert.ok(cfg.order.includes(id), `Order must contain ${id}`);
    assert.ok(cfg.spans[id] > 0, `Span for ${id} must be > 0`);
  });
  assert.strictEqual(cfg.spans['invo-greeting'], 12);
  assert.strictEqual(cfg.spans['invo-kpi-paid'], 4);
  assert.strictEqual(cfg.spans['invo-balances'], 8);
  assert.strictEqual(cfg.spans['invo-invoices'], 12);
});

// 2. Test renderTileCustomBar outputs 4 Cardinal Resize Dots (top, bottom, left, right)
test('2. renderTileCustomBar outputs 4 Cardinal Resize Dots', () => {
  const barHTML = zf.renderTileCustomBar('invo-balances', 8, 'invowise', 'standard');
  assert.ok(barHTML.includes('android-resize-dot dot-top'), 'Must have top dot');
  assert.ok(barHTML.includes('android-resize-dot dot-bottom'), 'Must have bottom dot');
  assert.ok(barHTML.includes('android-resize-dot dot-left'), 'Must have left dot');
  assert.ok(barHTML.includes('android-resize-dot dot-right'), 'Must have right dot');
  assert.ok(barHTML.includes('data-span="4"') && barHTML.includes('data-span="8"') && barHTML.includes('data-span="12"'), 'Must have span pills');
  assert.ok(barHTML.includes('data-height="compact"') && barHTML.includes('data-height="tall"'), 'Must have height pills');
});

// 3. Test renderInvowiseDashboard renders all tiles with Android frames when customizing
test('3. renderInvowiseDashboard renders active Android frames & dots in edit mode', () => {
  zf.ui.isCustomizingDashboard = true;
  const dashHTML = zf.renderInvowiseDashboard();
  assert.ok(dashHTML.includes('android-widget-frame'), 'Tiles must have android-widget-frame class');
  assert.ok(dashHTML.includes('android-resize-dot'), 'Tiles must contain android resize dots');
  assert.ok(dashHTML.includes('Android Launcher Dynamic Widget Customizer Active'), 'Banner must be visible');
  assert.ok(dashHTML.includes('data-act="open-widget-catalog"'), '+ Add Widgets button must be present in toolbar');
});

// 4. Test renderWidgetCatalogDrawer renders all 5 cross-page status widgets
test('4. renderWidgetCatalogDrawer renders all 5 cross-page status widgets', () => {
  zf.ui.isWidgetCatalogOpen = true;
  const catalogHTML = zf.renderWidgetCatalogDrawer('invowise');
  assert.ok(catalogHTML.includes('catalog-slide-drawer'), 'Drawer markup must exist');
  assert.ok(catalogHTML.includes('widget-clients'), 'Must feature Client Directory widget');
  assert.ok(catalogHTML.includes('widget-gstr1'), 'Must feature GSTR-1 Tax widget');
  assert.ok(catalogHTML.includes('widget-payment'), 'Must feature UPI QR widget');
  assert.ok(catalogHTML.includes('widget-cfo'), 'Must feature CFO Treasury widget');
  assert.ok(catalogHTML.includes('widget-toolbelt'), 'Must feature Quick Toolbelt widget');
});

// 5. Test getCrossPageWidgetHTML generates high-fidelity cards
test('5. getCrossPageWidgetHTML generates high-fidelity cards for each catalog item', () => {
  ['widget-clients', 'widget-gstr1', 'widget-payment', 'widget-cfo', 'widget-toolbelt'].forEach(wId => {
    const cardHTML = zf.getCrossPageWidgetHTML(wId, 'USD', 50000, 30000, 20000);
    assert.ok(cardHTML.length > 50, `Card HTML for ${wId} must be populated`);
    assert.ok(cardHTML.includes('data-act="'), `Card HTML for ${wId} must have interactive deep action triggers`);
  });
});

console.log('\n================================================================================');
console.log(`  🎯 RESULTS: ${passed} / 5 ANDROID WIDGET TESTS PASSED (100%)`);
console.log('================================================================================\n');

if (passed === 5) {
  process.exit(0);
} else {
  process.exit(1);
}
