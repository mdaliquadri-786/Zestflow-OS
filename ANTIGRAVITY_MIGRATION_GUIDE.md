# ZestFlow v2 (Schema v3) — Argon vs. Google Antigravity (Gemini Flash Medium) Division of Work
**Owner:** Mohammed Ali Quadri (Founder, CodeWithAli, Hyderabad)

## 1. Argon (Heavy Architecture & Math Engine) Ne Kya-Kya Complete Aur Verify Kiya? (100% Done — 25/25 Tests PASS)
Kyunki aapke paas Google Antigravity mein **Gemini Flash Medium** hai (jo bade 2,700-line single-file architecture, integer financial math, aur cryptographic SHA-256 CSP hashes mein galti kar sakta hai), isliye **Argon (maine)** saare 5 core engineering phases (`PHASE 0` se `PHASE 4`) yahin build aur 25 automated tests se 100% verify kar diye hain:

- **PHASE 0 (Baseline Audit & Rollback Safety)**: `phase0_baseline_tests.js` (`10/10 PASS` now, originally 4 PASS / 6 FAIL). Untouched rollback copy `zestflow-v2.phase0-baseline.html` (`SHA-256: 1b5791582c7ce95c7c71ec414bef5fee9222b2bcb8b9a5dc1a1c4d7977a07c66`).
- **PHASE 1 (P0 Financial Engine, India GST & Data Safety)**: `phase1_verification_tests.js` (`8/8 PASS`).
  - Fixed `BASE-02` (3-decimal rate precision: `1000 × 0.125 = $125.00`).
  - Fixed `BASE-03` (strict numeric regex rejecting `"12abc"`).
  - Fixed `BASE-08` (strict `parseISO` rejecting invalid calendar dates like `2026-02-31`).
  - Added India GST (`CGST+SGST` intra-state vs. `IGST` inter-state), tax-inclusive/exclusive pricing, fixed/percent discounts, nearest-unit rounding, partial payments & refunds ledger (`payments[]`), `schemaVersion: 3` migration, and pre-import/pre-wipe rollback snapshots (`Undo / Restore last snapshot`).
- **PHASE 2 (P0 Security, Magic-Byte Check & Collision-Free Numbering)**: `phase2_3_4_verification_tests.js` (`P2-01` to `P2-04 PASS`).
  - Fixed `BASE-06`: Exact inline script SHA-256 hash (`sha256-MjhT1JI1yXy1oFB5mOWkZ6ru1ZRyUj7E+f6MQF9Fp1o=`) locked into CSP (`zestflow-v2.csp-hardened.html` for standalone hosting, and `zestflow-v2.html` for Canvas preview).
  - Added binary magic-byte verification (`PNG`, `JPEG`, `WebP`) on logo uploads and E.164 phone length validation (`8–15` digits) for WhatsApp links.
  - Fixed `BASE-07`: Collision-free `makeNumber()` + 5 Document Types (`Invoice`, `Tax Invoice`, `Quotation / Estimate`, `Pro Forma Invoice`, `Credit Note`) + 1-click Quote-to-Invoice & Credit Note generation + local activity history (`inv.history`).
- **PHASE 3 (P1 Multilingual Print, Bilingual Headers, Arabic-Indic Numerals, A11y & Light/Dark Theme)**: (`P3-01` & `P3-02 PASS`).
  - Multi-page print table header repetition (`thead { display: table-header-group }`).
  - Bilingual Print toggle (`Native + English` labels on Arabic, Urdu, and Telugu invoices).
  - Numeral System toggle (`Western 0–9` vs. `Arabic-Indic ٠–٩`).
  - Fixed `BASE-10`: Keyboard `Enter`/`Space` row selection on `.inv-row[tabindex="0"]` + Dark/Light (`data-theme="light"`) workspace toggle.
- **PHASE 4 (P2 Catalog, AR Ageing & In-App Self-Test Suite)**: (`P4-01 PASS`).
  - Saved Items/Services Catalog + Quick Client Picker in Editor.
  - Dashboard Accounts Receivable (AR) Ageing (`Current`, `1–30`, `31–60`, `61–90+` days overdue per currency).
  - Built-in 1-click Verification Self-Test Runner inside Settings (`6/6 PASS`).

## 2. Ab Google Antigravity (Gemini Flash Medium) Mein Aapko Kya Karna Hai? (PHASE 5 — Local Ops & Deployment)
Gemini Flash Medium **small, targeted local tasks** mein fast aur best hai. Jab aap `zestflow_antigravity_migration_pack.zip` ko Antigravity mein kholenge, toh Antigravity se sirf ye 3 local kaam karwayein:

1. **Run All 3 Verification Suites Locally**:
   Terminal mein ye single command chalayein:
   ```bash
   node phase0_baseline_tests.js && node phase1_verification_tests.js && node phase2_3_4_verification_tests.js
   ```
   Aapko `25/25 PASS` dikhega.
2. **Real Desktop Browser A4 PDF Print & Font Check**:
   Antigravity se `zestflow-v2.csp-hardened.html` (ya `zestflow-v2.html`) ko apne local Chrome/Edge browser mein open karein, `Load 4 sample invoices` dabayein, aur `Ctrl+P` daba kar English, Arabic, Urdu, aur Telugu ka real A4 PDF save karke dekhein.
3. **One-Command Vercel / Cloudflare Pages Deployment**:
   Antigravity ke agent ko ye chhota prompt dein:
   ```text
   Run phase0_baseline_tests.js, phase1_verification_tests.js, and phase2_3_4_verification_tests.js to confirm all 25 tests pass. Do NOT rewrite the core financial engine in zestflow-v2.html. Copy zestflow-v2.csp-hardened.html as index.html and prepare a clean vercel.json / static deployment config so I can deploy ZestFlow live.
   ```
