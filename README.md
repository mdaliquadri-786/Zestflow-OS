# ⚡ ZestFlow OS — Multi-Currency Invoicing & Financial Operations Platform

> **Live Production Deployment:** [https://zestflow-seven.vercel.app/](https://zestflow-seven.vercel.app/)  
> **Engineered by:** Mohammed Ali Quadri ([CodeWithAli](https://codewithali.com))

---

## 🏛️ Executive Summary

**ZestFlow OS** is a local-first commercial invoicing and financial operations platform engineered for modern businesses, freelancers, and cross-border teams. 

Designed with mathematical precision, native bidirectional typography (Arabic, Urdu Nastaliq, Telugu, and English), automated tax computation engines (India GST Place-of-Supply, Saudi ZATCA Phase-2), and instant vector UPI payment settlements.

---

## 💎 Core Architecture & Capabilities

### 1. 🇮🇳 Automated Indian GST & Place-of-Supply Intelligence
* **Autonomous Tax Regime Decomposition:** Seamlessly detects supplier state vs. client place of supply.
* **Intra-State:** Decomposes into **CGST (9%) + SGST (9%)**.
* **Inter-State:** Decomposes into **IGST (18%)**.
* **Reverse Charge Mechanism (RCM):** Regulatory compliance toggle with audit flags.

### 2. 💳 Instant Payment Settlement & Dynamic QR Engine
* **Vector UPI QR Generator:** Computes compliant `upi://pay?pa=...&am=...&tn=...` vector QR codes on the fly.
* **Instant Settlement Compatibility:** Google Pay, PhonePe, Paytm, BHIM UPI.
* **🇸🇦 Saudi ZATCA Compliance:** Generates official Phase-2 TLV Base64 QR code standards for KSA & GCC e-invoicing.

### 3. 🌍 Multilingual Bidirectional Typesetting (RTL / LTR)
* Native typography engines for **Arabic (العربية)**, **Urdu Nastaliq (اردو)**, **Telugu (తెలుగు)**, and **English**.
* Fully aligned right-to-left layout persistence, mathematical table reversals, and localized amount-in-words engines.

### 4. 🎨 7 Curated Industrial Archetypes
* **Modern SaaS:** Crisp typography, corporate header gradients, and modern badge indicators.
* **Minimal Swiss:** Bauhaus-inspired grid discipline with high tabular density.
* **Creative Studio:** Bold asymmetrical typographic contrast for agencies and design firms.
* **Corporate Ledger:** Dual signatory certification boxes, formal document header banners, and verified company stamp rings.
* **Consultant Claim:** Institutional reimbursement claims with shift logs, conveyance breakdowns, and verification badges.
* **Official Receipt & Purchase Order:** Dedicated commercial lifecycle states with customized terminology.
* **Compact Receipt:** Streamlined slip format for fast-paced retail and counter billing.

### 5. 📊 Executive Financial Analytics & P&L Intelligence
* Real-time P&L invoiced volume tracking.
* Net cash realized collections vs. outstanding accounts receivable (AR).
* 4-tier receivables ageing schedule (`Current`, `1–30 Days`, `31–60 Days`, `61–90+ Days Overdue`).
* Automated place-of-supply tax accumulation schedule.

### 6. 🔒 Storage Architecture, Cloud Sync & Security
* **Local-First Reliability:** Invoices, business profiles, and ledgers are stored directly in browser local storage (`LocalStorage` / `IndexedDB`), functioning fully offline without server dependency.
* **Authenticated Cloud Sync:** Optional multi-device synchronization powered by Supabase PostgreSQL with strict Row-Level Security (RLS) policies and OAuth / Magic Link authentication.
* **Direct AI Generation:** Optional user-provided Gemini API key for natural language invoice generation, executed directly from the client without intermediate tracking.
* **Data Sovereignty:** Full one-click JSON vault export and CSV ledger backups ensure 100% data portability.
* **Strict CSP:** Content-Security-Policy with sha256 hash-locked script execution and zero `unsafe-inline` script evaluation.

---

## 🚀 Live Demo & Access

Experience ZestFlow OS live in production:
* **Web App:** [https://zestflow-seven.vercel.app/](https://zestflow-seven.vercel.app/)
* **Executive Financial Report:** [https://zestflow-seven.vercel.app/#/report](https://zestflow-seven.vercel.app/#/report)
* **Design Studio Gallery:** [https://zestflow-seven.vercel.app/#/new](https://zestflow-seven.vercel.app/#/new)

---

## 📜 Regulatory Standards & Protocols
* **India GST:** Model GST Law & Place of Supply Rules (IGST Act 2017).
* **Saudi ZATCA:** Fatoora Electronic Invoicing Specification (Phase 2 TLV).
* **UPI Standard:** NPCI Unified Payments Interface QR Specification v1.6.
* **Security:** Strict Content-Security-Policy (CSP) hash-locked architecture with zero `unsafe-inline` script evaluation.

---

*Copyright © 2026 ZestFlow OS · Architected & Engineered by Mohammed Ali Quadri.*
