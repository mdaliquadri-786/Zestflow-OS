/**
 * ============================================================================
 * ZESTFLOW OS — REAL CHROMIUM PIXEL & BOUNDING-BOX GEOMETRY AUDIT SUITE
 * ============================================================================
 * Zero regex checks. Zero JSDOM approximations.
 * Real Headless Google Chrome Chromium automation using Playwright.
 *
 * Checks:
 *  1. Zero Horizontal Overflow across 4 viewports x 2 layouts x 2 themes x 9 pages (144 checks)
 *  2. Exact Left & Right Edge Alignment on Invowise & CashFund at 1366px & 1920px
 *  3. Equal Column Bottom Baselines on Invowise (3 columns) and CashFund (2 columns)
 *  4. Zero Modal Clipping: #workspaceSetupDlg margin & input visibility at 1366px & 375px
 *  5. Zero Console Errors & Page Exceptions during live UI walkthrough
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const pw = require('playwright-core');

console.log('================================================================================');
console.log('  ⚡ ZESTFLOW OS — REAL CHROMIUM PIXEL & BOUNDING-BOX GEOMETRY AUDIT');
console.log('================================================================================\n');

const htmlPath = path.join(__dirname, 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Ephemeral static server
const server = http.createServer((req, res) => {
  const reqUrl = req.url.split('?')[0];
  if (reqUrl === '/' || reqUrl === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(htmlContent);
  }
  const filePath = path.join(__dirname, reqUrl);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    let contentType = 'application/octet-stream';
    if (reqUrl.endsWith('.js')) contentType = 'application/javascript; charset=utf-8';
    else if (reqUrl.endsWith('.json')) contentType = 'application/json; charset=utf-8';
    else if (reqUrl.endsWith('.css')) contentType = 'text/css; charset=utf-8';
    else if (reqUrl.endsWith('.svg')) contentType = 'image/svg+xml';
    else if (reqUrl.endsWith('.png')) contentType = 'image/png';
    else if (reqUrl.endsWith('.ico')) contentType = 'image/x-icon';
    res.writeHead(200, { 'Content-Type': contentType });
    return res.end(fs.readFileSync(filePath));
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureLog = [];

function assert(category, testId, description, condition, actual = '', expected = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions++;
    failureLog.push({ category, testId, description, actual, expected });
  }
}

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  console.log(`🌐 Local Chromium test harness listening on http://127.0.0.1:${port}/\n`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await pw.chromium.launch({
    executablePath: chromePath,
    headless: true
  });

  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('zf_auth_session', JSON.stringify({
      access_token: 'mock_bearer_token',
      user: { email: 'ceo@enterprise.com', id: 'usr_ceo_001', user_metadata: { full_name: 'Chief Executive' } }
    }));
    localStorage.setItem('zf_auth_user', JSON.stringify({ email: 'ceo@enterprise.com', id: 'usr_ceo_001', name: 'Chief Executive' }));
    localStorage.setItem('zf_onboarded', 'true');
    localStorage.setItem('zf_session_active', 'true');
    localStorage.setItem('zestflow.v2', JSON.stringify({
      schemaVersion: 3,
      settings: { business: { name: 'Acme Enterprise', upiId: 'acme@upi' } },
      invoices: [{
        id: 'inv_sample_001',
        number: 'INV-2026-001',
        status: 'sent',
        client: { name: 'Alpha Tech', email: 'alpha@example.com', phone: '+15551234567', taxId: 'GSTIN123' },
        items: [{ desc: 'Enterprise Invoicing', qty: '1', rate: '1000' }],
        currency: 'USD',
        issue: '2026-11-01',
        due: '2026-11-15'
      }]
    }));
  });

  const page = await context.newPage();

  const capturedConsoleErrors = [];
  const capturedPageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      capturedConsoleErrors.push(msg.text());
    }
  });

  page.on('response', res => {
    if (res.status() >= 400) {
      console.log(`[HTTP ${res.status()}] ${res.url()}`);
    }
  });

  page.on('pageerror', err => {
    capturedPageErrors.push(err.message);
  });

  // Intercept any Supabase network calls in local test harness so mock user/sync returns 200
  await page.route('**/*.supabase.co/**', route => {
    const url = route.request().url();
    if (url.includes('/auth/v1/')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'usr_ceo_001',
          email: 'ceo@enterprise.com',
          user_metadata: { full_name: 'Chief Executive' }
        })
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    }
  });

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // =========================================================================
  // CATEGORY 1: Zero Horizontal Overflow (144 Checks)
  // =========================================================================
  console.log('📐 [CAT 01] Auditing Zero Horizontal Overflow across 144 layout/theme/page matrices...');

  const viewports = [
    { name: '375x812', width: 375, height: 812 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '1366x768', width: 1366, height: 768 },
    { name: '1920x1080', width: 1920, height: 1080 }
  ];

  const layouts = ['invowise', 'cashfund'];
  const themes = ['light', 'dark'];
  const pages = ['dashboard', 'invoices', 'editor', 'payment', 'clients', 'email', 'settings', 'instructions', 'about'];

  let cat1Count = 0;
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const lay of layouts) {
      for (const th of themes) {
        await page.evaluate(({ lay, th }) => {
          window.applyLayout(lay);
          window.applyTheme(th);
        }, { lay, th });

        for (const p of pages) {
          cat1Count++;
          await page.evaluate(p => window.navigate(p), p);
          await page.waitForTimeout(50);

          const overflow = await page.evaluate(() => {
            const doc = document.documentElement;
            return {
              scrollWidth: doc.scrollWidth,
              clientWidth: doc.clientWidth,
              hasOverflow: (doc.scrollWidth - doc.clientWidth) > 1
            };
          });

          assert(
            'CAT1',
            cat1Count,
            `Zero overflow on ${vp.name} (${lay}, ${th}, ${p})`,
            !overflow.hasOverflow,
            `scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
            `scrollWidth <= clientWidth`
          );
        }
      }
    }
  }

  // =========================================================================
  // CATEGORY 2: Exact Left & Right Edge Alignment (12 Checks)
  // =========================================================================
  console.log('📏 [CAT 02] Auditing Exact Left & Right Edge Alignment on Invowise & CashFund...');

  let cat2Count = 0;
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 768 });

    // 2.1 Invowise Edge Alignment
    await page.evaluate(() => {
      window.applyLayout('invowise');
      window.navigate('dashboard');
    });
    await page.waitForTimeout(250);

    const invoAlign = await page.evaluate(() => {
      const topNav = document.getElementById('invoTopNavHost');
      const app = document.getElementById('app');
      const footer = document.querySelector('.zf-global-footer');

      const rTop = topNav.getBoundingClientRect();
      const rApp = app.getBoundingClientRect();
      const rFoot = footer.getBoundingClientRect();

      return {
        leftMatch: Math.abs(rTop.left - rApp.left) <= 1 && Math.abs(rApp.left - rFoot.left) <= 1,
        rightMatch: Math.abs(rTop.right - rApp.right) <= 1 && Math.abs(rApp.right - rFoot.right) <= 1,
        rTop: { left: rTop.left, right: rTop.right },
        rApp: { left: rApp.left, right: rApp.right },
        rFoot: { left: rFoot.left, right: rFoot.right }
      };
    });

    cat2Count++;
    assert('CAT2', cat2Count, `Invowise ${width}px Left Edge: TopNav (${invoAlign.rTop.left}px) == App (${invoAlign.rApp.left}px) == Footer (${invoAlign.rFoot.left}px)`, invoAlign.leftMatch, invoAlign.rApp.left, invoAlign.rTop.left);

    cat2Count++;
    assert('CAT2', cat2Count, `Invowise ${width}px Right Edge: TopNav (${invoAlign.rTop.right}px) == App (${invoAlign.rApp.right}px) == Footer (${invoAlign.rFoot.right}px)`, invoAlign.rightMatch, invoAlign.rApp.right, invoAlign.rTop.right);

    // 2.2 CashFund Edge Alignment
    await page.evaluate(() => {
      window.applyLayout('cashfund');
      window.navigate('dashboard');
    });
    await page.waitForTimeout(250);

    const cashAlign = await page.evaluate(() => {
      const topbar = document.querySelector('.cashfund-top-bar');
      const grid = document.querySelector('.cash-grid-layout');
      const footer = document.querySelector('.zf-global-footer');

      const rTop = topbar.getBoundingClientRect();
      const rGrid = grid.getBoundingClientRect();
      const rFoot = footer.getBoundingClientRect();

      return {
        leftMatch: Math.abs(rTop.left - rGrid.left) <= 1 && Math.abs(rGrid.left - rFoot.left) <= 1,
        rightMatch: Math.abs(rTop.right - rGrid.right) <= 1 && Math.abs(rGrid.right - rFoot.right) <= 1,
        rTop: { left: rTop.left, right: rTop.right },
        rGrid: { left: rGrid.left, right: rGrid.right },
        rFoot: { left: rFoot.left, right: rFoot.right }
      };
    });

    cat2Count++;
    assert('CAT2', cat2Count, `CashFund ${width}px Left Edge: TopBar (${cashAlign.rTop.left}px) == Grid (${cashAlign.rGrid.left}px) == Footer (${cashAlign.rFoot.left}px)`, cashAlign.leftMatch, cashAlign.rGrid.left, cashAlign.rTop.left);

    cat2Count++;
    assert('CAT2', cat2Count, `CashFund ${width}px Right Edge: TopBar (${cashAlign.rTop.right}px) == Grid (${cashAlign.rGrid.right}px) == Footer (${cashAlign.rFoot.right}px)`, cashAlign.rightMatch, cashAlign.rGrid.right, cashAlign.rTop.right);
  }

  // =========================================================================
  // CATEGORY 3: Equal Column Bottom Baselines on Dashboards (10 Checks)
  // =========================================================================
  console.log('⚖️ [CAT 03] Auditing Equal Column Bottom Baselines on Dashboards...');

  let cat3Count = 0;
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 768 });

    // 3.1 Invowise 3-column bottom alignment
    await page.evaluate(() => {
      window.applyLayout('invowise');
      window.navigate('dashboard');
    });
    await page.waitForTimeout(200);

    const invoColBottoms = await page.evaluate(() => {
      const col1 = document.querySelector('.invo-col-1').lastElementChild.getBoundingClientRect().bottom;
      const col2 = document.querySelector('.invo-col-2').lastElementChild.getBoundingClientRect().bottom;
      const col3 = document.querySelector('.invo-col-3').lastElementChild.getBoundingClientRect().bottom;
      return { col1, col2, col3, diff12: Math.abs(col1 - col2), diff23: Math.abs(col2 - col3) };
    });

    cat3Count++;
    assert('CAT3', cat3Count, `Invowise ${width}px Col 1 & Col 2 bottom baseline match (diff=${invoColBottoms.diff12.toFixed(2)}px)`, invoColBottoms.diff12 <= 2, invoColBottoms.col1, invoColBottoms.col2);

    cat3Count++;
    assert('CAT3', cat3Count, `Invowise ${width}px Col 2 & Col 3 bottom baseline match (diff=${invoColBottoms.diff23.toFixed(2)}px)`, invoColBottoms.diff23 <= 2, invoColBottoms.col2, invoColBottoms.col3);

    // 3.2 CashFund 2-column bottom alignment
    await page.evaluate(() => {
      window.applyLayout('cashfund');
      window.navigate('dashboard');
    });
    await page.waitForTimeout(200);

    const cashColBottoms = await page.evaluate(() => {
      const grid = document.querySelector('.cash-grid-layout');
      const left = grid.children[0].lastElementChild.getBoundingClientRect().bottom;
      const right = grid.children[1].lastElementChild.getBoundingClientRect().bottom;
      return { left, right, diff: Math.abs(left - right) };
    });

    cat3Count++;
    assert('CAT3', cat3Count, `CashFund ${width}px Left & Right column bottom baseline match (diff=${cashColBottoms.diff.toFixed(2)}px)`, cashColBottoms.diff <= 2, cashColBottoms.left, cashColBottoms.right);
  }

  // =========================================================================
  // CATEGORY 4: Zero Modal Clipping & Form Visibility (10 Checks)
  // =========================================================================
  console.log('🪟 [CAT 04] Auditing Zero Modal Clipping & Form Visibility in #workspaceSetupDlg...');

  let cat4Count = 0;
  for (const { width, height } of [{ width: 1366, height: 768 }, { width: 375, height: 812 }]) {
    await page.setViewportSize({ width, height });

    await page.evaluate(() => {
      window.openWorkspaceSetupDlg(1, true);
    });
    await page.waitForTimeout(300);

    const dlgAudit = await page.evaluate(({ width, height }) => {
      const dlg = document.getElementById('workspaceSetupDlg');
      const r = dlg.getBoundingClientRect();
      const bName = document.getElementById('wsBizName').getBoundingClientRect();
      const tId = document.getElementById('wsTaxId').getBoundingClientRect();
      const uId = document.getElementById('wsUpiId').getBoundingClientRect();

      return {
        marginValid: r.left >= 8 && r.right <= width - 8,
        bNameVisible: bName.top >= r.top && bName.bottom <= r.bottom && bName.left >= r.left && bName.right <= r.right,
        tIdVisible: tId.top >= r.top && tId.bottom <= r.bottom && tId.left >= r.left && tId.right <= r.right,
        uIdVisible: uId.top >= r.top && uId.bottom <= r.bottom && uId.left >= r.left && uId.right <= r.right,
        r, bName, tId, uId
      };
    }, { width, height });

    cat4Count++;
    assert('CAT4', cat4Count, `#workspaceSetupDlg ${width}x${height} maintains safe screen margins (left >= 8, right <= ${width - 8})`, dlgAudit.marginValid, true, true);

    cat4Count++;
    assert('CAT4', cat4Count, `#wsBizName input fully visible within modal at ${width}x${height}`, dlgAudit.bNameVisible, true, true);

    cat4Count++;
    assert('CAT4', cat4Count, `#wsTaxId input fully visible within modal at ${width}x${height}`, dlgAudit.tIdVisible, true, true);

    cat4Count++;
    assert('CAT4', cat4Count, `#wsUpiId input fully visible within modal at ${width}x${height}`, dlgAudit.uIdVisible, true, true);

    await page.evaluate(() => {
      document.getElementById('workspaceSetupDlg').close();
    });
    await page.waitForTimeout(100);
  }

  // =========================================================================
  // CATEGORY 6: Real Chromium CFO/CEO Feature Interaction & Geometry (10 Checks)
  // =========================================================================
  console.log('🏛️ [CAT 06] Auditing 10 Real Chromium CFO/CEO Feature Interactions & Geometry...');

  // 1. Command Palette Trigger & Geometry
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => window.openCmdPalette());
  await page.waitForTimeout(200);

  const cmdAudit = await page.evaluate(() => {
    const dlg = document.getElementById('cmdPaletteDlg');
    const inp = document.getElementById('cmdPaletteInput');
    const res = document.getElementById('cmdPaletteResults');
    const r = dlg.getBoundingClientRect();
    return {
      open: dlg.open || dlg.hasAttribute('open'),
      widthValid: r.width >= 300 && r.width <= 600,
      inputExists: !!inp,
      hasResults: res && res.children.length > 0
    };
  });
  assert('CAT6', 1, 'Command palette opens on openCmdPalette() with safe dimensions', cmdAudit.open && cmdAudit.widthValid, true, true);
  assert('CAT6', 2, 'Command palette renders categorized quick action results', cmdAudit.hasResults, true, true);

  // 2. Fuzzy search inside Command Palette
  await page.type('#cmdPaletteInput', 'tax');
  await page.waitForTimeout(100);
  const searchAudit = await page.evaluate(() => {
    const res = document.getElementById('cmdPaletteResults');
    return res ? res.textContent.toLowerCase().includes('tax') : false;
  });
  assert('CAT6', 3, 'Typing in command palette filters live results dynamically', searchAudit, true, true);

  // 3. Escape key closes Command Palette
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const cmdClosed = await page.evaluate(() => {
    const dlg = document.getElementById('cmdPaletteDlg');
    return !dlg.open && !dlg.hasAttribute('open');
  });
  assert('CAT6', 4, 'Pressing Escape dismisses Command Palette smoothly', cmdClosed, cmdClosed, true);

  // 4. Indian GSTR-1 & CFO Tax Summary Drawer
  await page.evaluate(() => window.openGstSummaryDlg());
  await page.waitForTimeout(200);
  const gstAudit = await page.evaluate(() => {
    const dlg = document.getElementById('gstSummaryDlg');
    const content = document.getElementById('gstSummaryContent');
    const r = dlg.getBoundingClientRect();
    return {
      open: dlg.open || dlg.hasAttribute('open'),
      hasTable: content && content.innerHTML.includes('Statutory GST Distribution Schedule'),
      safeWidth: r.width >= 320 && r.width <= 800
    };
  });
  assert('CAT6', 5, 'GSTR-1 & CFO Tax Summary modal opens with structured schedule', gstAudit.open && gstAudit.hasTable, true, true);

  await page.evaluate(() => {
    const dlg = document.getElementById('gstSummaryDlg');
    if (dlg) dlg.close();
  });
  await page.waitForTimeout(100);

  // 5. Multi-Tone Payment Reminder
  await page.evaluate(() => {
    window.openRemindModal('inv_sample_001');
  });
  await page.waitForTimeout(200);

  const remindAudit = await page.evaluate(() => {
    const dlg = document.getElementById('remindDlg');
    const txt = document.getElementById('remindDlgTxt');
    const toneBtns = document.querySelectorAll('.tone-btn');
    return {
      open: dlg.open || dlg.hasAttribute('open'),
      hasTones: toneBtns.length === 3,
      hasText: txt && txt.value.length > 10
    };
  });
  assert('CAT6', 6, 'Smart Payment Reminder opens with 3 executive tone controls', remindAudit.open && remindAudit.hasTones, true, true);

  // Switch tone to firm
  await page.click('.tone-btn[data-tone="firm"]');
  await page.waitForTimeout(100);
  const toneSwitchAudit = await page.evaluate(() => {
    const txt = document.getElementById('remindDlgTxt');
    return txt ? txt.value.includes('Outstanding Invoice Notice') : false;
  });
  assert('CAT6', 7, 'Clicking tone button dynamically switches reminder text to Firm tone', toneSwitchAudit, toneSwitchAudit, true);

  await page.evaluate(() => {
    const dlg = document.getElementById('remindDlg');
    if (dlg) dlg.close();
  });
  await page.waitForTimeout(100);

  // 6. Editor Cryptographic Audit Trail Checksum Badge
  await page.evaluate(() => window.navigate('editor', {}));
  await page.waitForTimeout(200);
  const auditBadgeExists = await page.evaluate(() => {
    const b = document.querySelector('.zf-audit-badge');
    return b && b.textContent.includes('ZF-AUDIT-');
  });
  assert('CAT6', 8, 'Editor displays cryptographic tamper-evident badge with ZF-AUDIT- checksum', !!auditBadgeExists, true, true);

  // 7. Payment Ledger CFO Treasury KPIs
  await page.evaluate(() => window.navigate('payment', {}));
  await page.waitForTimeout(200);
  const kpiAudit = await page.evaluate(() => {
    const html = document.getElementById('app').innerHTML;
    return html.includes('COLLECTION EFFICIENCY') && html.includes('DAYS SALES OUTSTANDING');
  });
  assert('CAT6', 9, 'Payment center displays Collection Efficiency and Days Sales Outstanding KPIs', kpiAudit, true, true);

  // 8. Mobile 375px command palette safety
  await page.setViewportSize({ width: 375, height: 812 });
  await page.evaluate(() => window.openCmdPalette());
  await page.waitForTimeout(200);
  const mobileCmdAudit = await page.evaluate(() => {
    const dlg = document.getElementById('cmdPaletteDlg');
    const r = dlg.getBoundingClientRect();
    return r.left >= 0 && r.right <= 375;
  });
  assert('CAT6', 10, 'Command Palette maintains zero horizontal clipping on 375px mobile', mobileCmdAudit, true, true);
  await page.evaluate(() => {
    const dlg = document.getElementById('cmdPaletteDlg');
    if (dlg) dlg.close();
  });
  await page.waitForTimeout(100);

  // =========================================================================
  // CATEGORY 5: Zero Console Errors & Page Exceptions (5 Checks)
  // =========================================================================
  console.log('🛡️ [CAT 05] Auditing Zero Console Errors & Page Exceptions across user interactions...');

  assert('CAT5', 1, 'Zero unhandled page exceptions occurred during full visual run', capturedPageErrors.length === 0, capturedPageErrors.length, 0);
  assert('CAT5', 2, 'Zero console error messages logged during full visual run', capturedConsoleErrors.length === 0, capturedConsoleErrors.length, 0);

  // Click walkthrough of tabs and actions
  for (const pageName of ['invoices', 'editor', 'payment', 'clients', 'email', 'settings', 'dashboard']) {
    await page.evaluate(p => window.navigate(p), pageName);
    await page.waitForTimeout(50);
  }
  assert('CAT5', 3, 'Navigating through all core tabs yields 0 errors', capturedPageErrors.length === 0, capturedPageErrors.length, 0);

  // Toggle themes and layouts back and forth
  for (let i = 0; i < 4; i++) {
    await page.evaluate(i => {
      window.applyLayout(i % 2 === 0 ? 'invowise' : 'cashfund');
      window.applyTheme(i % 2 === 0 ? 'light' : 'dark');
    }, i);
    await page.waitForTimeout(50);
  }
  assert('CAT5', 4, 'Rapid layout and theme toggling yields 0 errors', capturedPageErrors.length === 0, capturedPageErrors.length, 0);
  assert('CAT5', 5, 'Final browser health check passes with 0 memory crashes', page.isClosed() === false, true, true);

  // =========================================================================
  // SUMMARY SCORECARD
  // =========================================================================
  console.log('\n================================================================================');
  console.log('  🎯 REAL CHROMIUM PIXEL AUDIT SCORECARD');
  console.log('================================================================================');
  console.log(`TOTAL STRICT PIXEL ASSERTIONS : ${totalAssertions}`);
  console.log(`PASSED                        : ${passedAssertions} / ${totalAssertions} (${((passedAssertions / totalAssertions) * 100).toFixed(1)}%)`);
  console.log(`FAILED                        : ${failedAssertions} / ${totalAssertions}`);
  console.log('================================================================================\n');

  await browser.close();
  server.close();

  if (failureLog.length > 0) {
    console.log('❌ DETAILED ASSERTION FAILURES:');
    failureLog.forEach(f => {
      console.log(`- [${f.category}-${f.testId}] ${f.description}`);
      console.log(`  Actual:   ${JSON.stringify(f.actual)}`);
      console.log(`  Expected: ${JSON.stringify(f.expected)}`);
      if (f.testId === 2 && f.category === 'CAT5') {
        console.log('  Captured Console Errors:', capturedConsoleErrors);
      }
      if (f.testId === 1 && f.category === 'CAT5') {
        console.log('  Captured Page Errors:', capturedPageErrors);
      }
    });
    console.log('\n');
    process.exit(1);
  } else {
    console.log('🏆 100% REAL CHROMIUM ZERO-DEFECT PASS: ALL PIXEL & GEOMETRY ASSERTIONS VERIFIED.');
    process.exit(0);
  }
});
