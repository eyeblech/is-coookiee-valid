# CRUMBLAB // Cookie Anatomy & RFC-6265 Telemetry Studio

![CRUMBLAB Version](https://img.shields.io/badge/CRUMBLAB-v2.4_STUDIO-CCFF00?style=for-the-badge&labelColor=090A0F)
![RFC-6265](https://img.shields.io/badge/SPEC-RFC_6265-00F0FF?style=for-the-badge&labelColor=090A0F)
![Stack](https://img.shields.io/badge/STACK-NODE.JS_%2B_REACT_%2B_VITE-FF5E5B?style=for-the-badge&labelColor=090A0F)

**CRUMBLAB** is a Neo-Brutalist developer workbench for inspecting HTTP cookies, decompiling inner JWT/Base64 payloads, auditing RFC-6265 security compliance, and transpiling between cookie formats.

---

## ✨ Core Capabilities

- **Universal Format Auto-Detection**
  - **Browser / DevTools JSON** (`EditThisCookie`, `Cookie-Editor`, Puppeteer/Playwright exports)
  - **Netscape HTTP Cookie Files (`cookies.txt`)** (including `#HttpOnly_` prefixes)
  - **HTTP `Set-Cookie` & `Cookie` Headers**
  - **HAR (HTTP Archive) Captures**
  - **cURL Commands** (automatically extracts target URL, cookies, and custom headers)
- **Deep Payload Decompiler**
  - Automatically detects and decodes inner **JWTs (JSON Web Tokens)**, URL-encoded JSON, Base64 payloads, Express signed cookies (`s:...`), and Laravel encrypted payloads.
  - Flags cookies whose inner JWT `exp` claim has expired even when the outer cookie header appears active.
- **RFC-6265 & Security Prefix Auditor**
  - Audits `__Host-` and `__Secure-` prefix invariants (`Secure`, `Path=/`, absence of `Domain`), `SameSite=None` without `Secure`, 4096-byte quota limits, and missing `HttpOnly`/`Secure` flags on authentication cookies.
- **Live HTTP Endpoint Probe & Host Scanner**
  - Built-in Express backend proxy dispatches single-request HTTP probes to test your endpoints without browser CORS blocks, tracing redirect chains and capturing emitted `Set-Cookie` headers.
- **One-Click Clean Transpiler**
  - Purge expired or malformed cookies and export cleanly to **JSON**, **Netscape `cookies.txt`**, **HTTP Header**, **`Set-Cookie`**, **cURL**, or **Python `requests`**.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Launch the development studio (Frontend + API on port 3000)
npm run dev
```

Open **`http://localhost:3000`** in your browser.

---

## 🧪 Testing & Production Build

```bash
# Run unit & API integration tests
npm test

# Build optimized production bundle
npm run build

# Start production server
npm start
```

---

## 🗂️ Project Structure

```text
├── index.html                        # Studio entry with Syne, Space Grotesk & Space Mono typography
├── server/
│   └── index.js                      # Express API server (/api/verify, /api/scan-url, /api/mock-auth)
├── src/
│   ├── App.jsx                       # Main CRUMBLAB Neo-Brutalist workbench UI
│   ├── index.css                     # Blueprint backgrounds, brutalist shadows & radar animations
│   ├── components/
│   │   ├── CookieDetailPanel.jsx     # Specimen payload decompiler & RFC-6265 diagnostic panel
│   │   ├── LiveVerifierPanel.jsx     # Live HTTP probe & redirect hop tracer
│   │   └── ExportConverterPanel.jsx  # Multi-format serializer & valid-only filter
│   └── utils/
│       ├── cookieEngine.js           # Universal parser, JWT decoder, validator & exporter
│       └── samplePresets.js          # Dynamic lab presets
└── tests/
    └── cookieEngine.test.js          # Automated test suite
```
