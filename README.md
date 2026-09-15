# FILLO

> **Fill once. Apply anywhere.**

FILLO is a privacy-first Chrome browser extension designed to intelligently autofill repetitive web forms using a user's locally stored profile.

---

## Milestone Status

- [x] **Milestone 1**: Clean Manifest V3 extension skeleton & Vite build pipeline.
- [x] **Milestone 2**: Local profile management system using `chrome.storage.local`.
- [x] **Milestone 3A**: Intelligent form field detection & metadata extraction (Read-Only).
- [x] **Milestone 3B**: Deterministic field mapping heuristics & explainable confidence scoring.
- [x] **Milestone 4**: Safe autofill engine & conservative safety gate.
- [x] **Milestone 5**: Real-world form compatibility & user-triggered autofill UX.
- [x] **Milestone 6**: Production hardening & real-world compatibility.

---

## Milestone 6: Production Hardening & Real-World Compatibility

Milestone 6 hardens FILLO for messy, real-world web applications while strictly preserving its conservative, privacy-first, and local-first architecture:

1. **SPA Route Change Awareness**:
   - Transparently intercepts `history.pushState` and `history.replaceState`, and listens to `popstate`.
   - On route changes, invalidates stale/disconnected field references and rescans the new page view.
   - **Zero Automatic Autofill**: Route transitions NEVER trigger automatic filling; filling requires explicit user click.

2. **Stale DOM Reference Pruning**:
   - Evaluates `element.isConnected`: removed or replaced form fields are automatically pruned from active field inventory.
   - Prevents stale element references from lingering in memory or causing ghost fields in popup status summaries.

3. **Open Shadow DOM Traversal**:
   - Automatically traverses open Shadow DOM roots (`element.shadowRoot`) to discover web-component-encapsulated form controls.
   - Closed Shadow DOM roots (`mode: 'closed'`) are intentionally inaccessible by browser security design and are documented as a limitation.

4. **ARIA-Only & Autocomplete-Driven Forms**:
   - Robustly extracts signals from `aria-label`, `aria-labelledby`, and standard HTML5 `autocomplete` tokens (`given-name`, `family-name`, `email`, `tel`, etc.) even when visible `<label>` tags are absent.
   - Context safety overrides autocomplete when contradictory keywords (e.g. `confirm`, `emergency`, `recruiter`) are detected.

5. **Framework-Controlled Inputs (React / Vue / Angular)**:
   - Uses prototype property descriptor setters to ensure internal framework state trackers (such as React's `_valueTracker`) observe value assignments.
   - Dispatches bubbling, cancelable `input` and `change` events.

6. **Deterministic Select Normalization**:
   - Normalizes option matching across whitespace, letter casing, hyphens, and underscores without fuzzy guessing or approximations.
   - Safely skips unmatched options.

7. **Conservative Refusal of Custom Controls & Contenteditable**:
   - Safely skips non-native custom dropdowns (e.g. `<div role="combobox">`) and `<div contenteditable="true">` elements to preserve determinism.

8. **Restricted Pages & Message Safety**:
   - Gracefully degrades on internal or restricted browser URLs (`chrome://`, `chrome-extension://`, `devtools://`, `about:`) with `"FILLO isn't available on this page."`
   - Content script strictly validates message schemas, rejects unknown message types, and loads profile data directly from storage (never accepts profile payloads from popup messages).

9. **Zero-Leak Privacy Audit**:
   - Strictly zero personal profile values are logged to console, passed through status queries, or emitted in popup summaries.

---

### Known Limitations

1. **Closed Shadow DOM**: Elements inside closed shadow roots cannot be accessed via standard DOM APIs by browser security design.
2. **Cross-Origin IFrames**: Iframes loaded from a different origin cannot be inspected or filled from the top-frame content script due to Same-Origin Policy.
3. **Complex Non-Native Comboboxes**: Custom JavaScript-rendered dropdowns (e.g. custom `div`/`li` comboboxes without a native `<select>` or typed input) are skipped to avoid non-deterministic menu clicks.
4. **Rich Text / Contenteditable**: Elements using `contenteditable="true"` are skipped for deterministic safety.

Milestone 5 elevates FILLO into a controlled, reliable, and user-initiated extension experience on realistic web forms:

```text
                  WEB PAGE
                     │
                     ▼
              M3A Field Detector
                     │
                     ▼
               FieldMetadata
                     │
                     ▼
               M3B Mapper
                     │
                     ▼
             FieldMappingResult
                     │
                     ▼
               M4 Safety Gate
                     │
                     ▼
              Profile Resolver
                     │
                     ▼
        Popup User Trigger ("Fill with FILLO")
                     │
                     ▼
            Autofill Controller
                     │
                     ▼
               Autofill Engine
                     │
                     ▼
            Web Form Controls (DOM)
```

### Core Milestone 5 Principles:
1. **User-Triggered Execution (No Silent Autofill)**:
   - On page load and dynamic mutations, FILLO detects and maps fields for readiness, but **strictly modifies zero DOM values**.
   - DOM writing occurs **ONLY** when the user explicitly clicks `"Fill with FILLO"` in the extension popup.
2. **Popup ↔ Active Tab Communication**:
   - Popup sends `GET_AUTOFILL_STATUS` to query detection and eligibility counts.
   - User reviews detected counts and readiness before initiating fill.
   - Popup sends `EXECUTE_AUTOFILL` to trigger safe autofill and displays a compact execution summary (e.g. `✓ FILLO filled 9 fields` with an itemized skipped list).
   - Strictly zero personal profile values are transmitted in messages or displayed in summaries.
3. **Centralized Negative Context Safeguards**:
   - Centralized vocabulary rules in `src/mapping/synonyms.ts` ensure third-party, confirmation, or reference fields are never filled with the user's personal details:
     - `"Confirm Email"` / `"Verify Email"` -> refused (negative confirmation context).
     - `"Emergency Contact Name"` / `"Emergency Contact Number"` -> refused (negative emergency context).
     - `"Company Name"` / `"Previous Company"` -> refused (company context).
     - `"Recruiter Name"` / `"Recruiter Phone"` -> refused (recruiter context).
     - `"Username"` -> refused (login credential context).
4. **Duplicate Prevention & Non-Overwriting**:
   - Uses `WeakSet<Element>` tracking: clicking `"Fill with FILLO"` multiple times will never re-fill or overwrite fields.
   - Any field with existing user-entered text is preserved untouched.

---

## Permissions & Manifest V3 Configuration

FILLO strictly adheres to the principle of **least privilege**:
- `"permissions": ["storage"]`: Used exclusively for storing profile data locally on the user's device via `chrome.storage.local`.
- `"content_scripts": [{ "matches": ["<all_urls>"], "js": ["content/content.js"], "run_at": "document_idle" }]`: Configures the content script to run on web pages when the DOM is idle.
- **No Redundant Host Permissions**: Zero redundant `host_permissions` declared.
- **No Broad Permissions Added**: Zero access to `tabs`, `activeTab`, `history`, `cookies`, `identity`, or network inspection APIs. Standard content-script messaging operates securely with zero additional permissions.
- **No Remote Code or Cloud Backend**: 100% deterministic, local-first execution.

---

## Directory Structure

```
fillo/
├── src/
│   ├── autofill/
│   │   ├── autofill-controller.ts # Orchestrates status & user-triggered fill
│   │   ├── autofill-engine.ts     # Core DOM writer & WeakSet tracking
│   │   ├── profile-value.ts       # Deterministic profile value resolver
│   │   ├── safety-gate.ts         # Conservative validation & refusal rules
│   │   └── value-writer.ts        # Safe DOM writer with bubbling events
│   ├── mapping/
│   │   ├── field-schema.ts        # Semantic profile field registry & helpers
│   │   ├── synonyms.ts            # Centralized field vocabulary & negative terms
│   │   ├── matcher.ts             # Tokenizer, phrase matcher & negative checks
│   │   ├── scorer.ts              # Evidence weighting, deduplication & scoring
│   │   └── mapper.ts              # Orchestrator & ambiguity resolver
│   ├── content/
│   │   ├── content.ts             # Content script entrypoint & message handlers
│   │   ├── field-detector.ts      # Core form control inspection & extraction
│   │   ├── label-detector.ts      # Multi-signal label discovery
│   │   └── mutation-observer.ts   # Debounced dynamic form observer
│   ├── popup/
│   │   ├── popup.html             # Tabbed popup (Autofill view & Profile view)
│   │   ├── popup.ts               # Tab handling, messaging, validation, storage
│   │   └── popup.css              # Dark-slate modern extension styling
│   ├── storage/
│   │   └── profile-storage.ts     # Dedicated chrome.storage.local wrapper
│   ├── types/
│   │   ├── profile.ts             # Strongly typed Profile interface
│   │   ├── field.ts               # FieldMetadata, DetectedField & FieldMappingResult
│   │   └── autofill.ts            # Autofill summaries, status & message protocols
│   ├── utils/
│   │   ├── normalize.ts           # Skills normalization & formatting
│   │   ├── normalize-field.ts     # Text & identifier normalization
│   │   └── validation.ts          # Profile form validators
│   ├── background/
│   │   └── service-worker.ts      # MV3 background service worker
├── public/
│   └── icons/                     # Source PNG icons (16x16, 48x48, 128x128)
├── tests/
│   └── forms/
│       ├── basic-form.html        # Comprehensive baseline test form
│       ├── job-application.html   # Realistic job application form with negative tests
│       ├── scholarship-form.html  # Alternative phrasing scholarship form
│       ├── internship-form.html   # Candidate vs recruiter/company form
│       └── complex-dynamic-form.html # Multi-step progressive disclosure form
├── scripts/
│   ├── generate-icons.js          # Valid binary PNG generator
│   ├── test-profile.js            # M2 Profile unit test suite (13 tests)
│   ├── test-field-detector.js     # M3A Field detector test suite (16 tests)
│   ├── test-field-mapping.js      # M3B Field mapping & confidence test suite (30 tests)
│   ├── test-autofill.js           # M4 Safe autofill engine test suite (36 tests)
│   ├── test-m5.js                 # M5 Real-world compatibility test suite (34 tests)
│   ├── verify-forms.js            # Automated verification across all 5 test forms
│   └── verify-extension.js        # Manifest V3 & asset verification suite
├── manifest.json                  # Manifest V3 configuration
├── package.json                   # Scripts & minimal devDependencies
├── tsconfig.json                  # TypeScript configuration
├── vite.config.ts                 # Vite build & bundle configuration
├── README.md                      # Project documentation
└── .gitignore                     # Version control ignores
```

---

## Build Output (`dist/`)

Vite bundles the project into a clean, Chrome-loadable extension directory:

```
dist/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── background/
│   └── service-worker.js
├── content/
│   └── content.js                 # Bundled content script (detector + mapper + controller)
├── assets/
│   └── profile-storage.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Getting Started

### 1. Prerequisites
- **Node.js**: >= 18.x (tested on v24.18.0)
- **npm**: >= 9.x (tested on 11.16.0)

### 2. Installation
Install the minimal dev dependencies:
```bash
npm install
```

### 3. Run Behavioral Tests
To verify all 174 automated behavioral tests across M2, M3A, M3B, M4, M5, and M6:
```bash
npm test
```

### 4. Build Extension
To run icon generation, all behavioral tests, TypeScript typechecking, Vite bundling, and extension verification:
```bash
npm run build
```

---

## How to Load into Google Chrome & Test

### 1. Load the Extension
1. Open **Google Chrome**.
2. Navigate to `chrome://extensions`.
3. In the top-right corner, toggle **Developer mode** to **ON**.
4. In the top-left toolbar, click **Load unpacked**.
5. Select the `dist` folder located at:
   ```text
   g:\Projects\Filloo\dist
   ```
6. **FILLO** (`v0.1.0`) will appear in your list of loaded extensions with zero errors or warnings.

### 2. Set Up Local Profile
1. Click the FILLO puzzle piece icon in the Chrome toolbar and pin **FILLO**.
2. Open the FILLO popup.
3. Switch to the **👤 Profile** tab.
4. Fill in your profile information (Full Name, Email, Phone, College, Degree, Branch, CGPA, Graduation Year, GitHub, LinkedIn, Portfolio, Skills, Location).
5. Click **Save Profile**.

### 3. Test Real-World Forms
Open each local test form in Google Chrome:
- **ARIA-Only Form**: `file:///g:/Projects/Filloo/tests/forms/aria-only-form.html`
- **Autocomplete-Only Form**: `file:///g:/Projects/Filloo/tests/forms/autocomplete-form.html`
- **SPA Dynamic Route Form**: `file:///g:/Projects/Filloo/tests/forms/spa-dynamic-form.html`
- **Framework-Like Form**: `file:///g:/Projects/Filloo/tests/forms/framework-like-form.html`
- **Edge Cases & Shadow DOM**: `file:///g:/Projects/Filloo/tests/forms/edge-case-form.html`
- **Basic Form**: `file:///g:/Projects/Filloo/tests/forms/basic-form.html`
- **Job Application**: `file:///g:/Projects/Filloo/tests/forms/job-application.html`
- **Scholarship Form**: `file:///g:/Projects/Filloo/tests/forms/scholarship-form.html`
- **Internship Form**: `file:///g:/Projects/Filloo/tests/forms/internship-form.html`
- **Complex Dynamic Form**: `file:///g:/Projects/Filloo/tests/forms/complex-dynamic-form.html`

### Verification Workflow for Each Form:
1. **On Page Load**: Verify that **zero fields are filled automatically**.
2. **Open Popup**:
   - Popup displays detection counts (e.g. `15 Detected • 12 Ready to Fill`).
   - Profile status indicates `Profile: ✓ Ready`.
3. **Click "Fill with FILLO"**:
   - Only eligible, high-confidence fields are populated with your profile data.
   - Negative context fields (`Company Name`, `Emergency Contact`, `Recruiter Name`, `Username`, `Confirm Email`) remain untouched.
   - Disabled, readonly, password, and pre-existing user values remain untouched.
   - Popup shows a compact summary: `✓ FILLO filled N field(s)` and an itemized skipped list.
4. **Click "Fill with FILLO" a Second Time**:
   - Observe that 0 additional fields are filled (no duplicate fills).
5. **Console Inspection**:
   - Open Developer Tools Console (**F12**).
   - Verify that **zero** personal profile values (e.g. your email, name, phone) appear in the logs.
