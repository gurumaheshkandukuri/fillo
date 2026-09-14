# FILLO

> **Fill once. Apply anywhere.**

FILLO is a privacy-first Chrome browser extension designed to intelligently autofill repetitive web forms using a user's locally stored profile.

---

## Milestone Status

- [x] **Milestone 1**: Clean Manifest V3 extension skeleton & Vite build pipeline.
- [x] **Milestone 2**: Local profile management system using `chrome.storage.local`.
- [x] **Milestone 3A**: Intelligent form field detection & metadata extraction (Read-Only).
- [x] **Milestone 3B**: Deterministic field mapping heuristics & explainable confidence scoring.
- [x] **Milestone 4**: Privacy-first local autofill engine & safety gate.

---

## Milestone 4: Safe Autofill Engine

In Milestone 4, FILLO introduces its safe autofill layer, allowing trusted semantic mappings from Milestone 3B to safely write local profile values into webpage controls (`<input>`, `<textarea>`, `<select>`):

```text
Web Page
   ↓
M3A Field Detection
   ↓
FieldMetadata
   ↓
M3B Field Mapping
   ↓
FieldMappingResult
   ↓
Confidence / Safety Gate (High confidence only >= 0.85)
   ↓
Local Profile Value Resolution
   ↓
Safe DOM Value Assignment (Bubbling input & change events)
   ↓
Verification (Zero submission, zero clicks, zero leaks)
```

### Strict Safety & Privacy Guarantees:
- **Autofill Only**: NEVER submits forms, clicks submit/action buttons, or navigates pages.
- **Conservative Confidence Threshold**: Automatically fills **only** if mapping confidence is `HIGH` (`>= 0.85`) and unambiguous.
  - Medium confidence (`0.65 - 0.84`) -> skipped (`reason: medium confidence`).
  - Low confidence (`< 0.65`) -> skipped (`reason: low confidence`).
  - Ambiguous mappings -> skipped (`reason: ambiguous mapping`).
- **Zero Overwriting**: Never overwrites existing user-entered text (`value !== ""` -> skipped).
- **DOM Safeguards**: Disabled, readonly, password, hidden, and unsupported input types (submit, button, file, radio, checkbox) are strictly refused.
- **Framework Compatibility**: Dispatches bubbling `input` and `change` events and accesses prototype setters to ensure React, Vue, and Angular controlled components update cleanly.
- **Duplicate Prevention**: Tracks autofilled elements using `WeakSet<Element>` to avoid re-filling fields during dynamic DOM mutation scans.
- **Privacy-First Logging**: Console logs record only semantic keys and statuses (e.g. `[FILLO] Autofilled: personal.email (high confidence)`). User profile values and filled values are NEVER logged to console.

---

## Confidence Level Interpretation

Scores are normalized between `0.00` and `1.00`, representing evidence strength:
- **High (`>= 0.85`)**: Eligible for safe autofill (unambiguous, multi-signal evidence match).
- **Medium (`0.65 - 0.84`)**: Moderate evidence; refused and skipped in M4.
- **Low (`< 0.65`)**: Weak evidence, generic terms (e.g. generic "Name"), or ambiguous competing matches; refused and skipped in M4.

---

## Permissions & Manifest V3 Configuration

FILLO strictly adheres to the principle of **least privilege**:
- `"permissions": ["storage"]`: Used exclusively for storing profile data locally on the user's device via `chrome.storage.local`.
- `"content_scripts": [{ "matches": ["<all_urls>"], "js": ["content/content.js"], "run_at": "document_idle" }]`: Configures the content script to run on web pages when the DOM is idle to inspect form controls and safely autofill matched fields.
- **No Redundant Host Permissions**: Zero redundant `host_permissions` entries declared.
- **No Broad Privacy Permissions**: Zero access to `tabs`, `cookies`, `history`, `identity`, or network inspection APIs.
- **No Remote Code or Cloud Backend**: 100% deterministic, local-first execution.

---

## Directory Structure

```
fillo/
├── src/
│   ├── autofill/
│   │   ├── autofill-engine.ts    # Autofill orchestrator & WeakSet tracking
│   │   ├── profile-value.ts      # Deterministic profile value resolver
│   │   ├── safety-gate.ts        # Conservative validation & refusal rules
│   │   └── value-writer.ts       # Safe DOM writer with bubbling events
│   ├── mapping/
│   │   ├── field-schema.ts       # Semantic profile field registry & helpers
│   │   ├── synonyms.ts           # Centralized field vocabulary & negative terms
│   │   ├── matcher.ts            # Tokenizer, phrase matcher & negative checks
│   │   ├── scorer.ts             # Evidence weighting, deduplication & scoring
│   │   └── mapper.ts             # Orchestrator & ambiguity resolver
│   ├── content/
│   │   ├── content.ts            # Content script entrypoint
│   │   ├── field-detector.ts     # Core form control inspection & extraction
│   │   ├── label-detector.ts     # Multi-signal label discovery
│   │   └── mutation-observer.ts  # Debounced dynamic form observer
│   ├── popup/
│   │   ├── popup.html            # Profile form & clear confirmation modal
│   │   ├── popup.ts              # Form handling, validation, DOM lifecycle
│   │   └── popup.css             # Sleek dark-slate extension styling
│   ├── storage/
│   │   └── profile-storage.ts    # Dedicated chrome.storage.local wrapper
│   ├── types/
│   │   ├── profile.ts            # Strongly typed Profile interface
│   │   ├── field.ts              # FieldMetadata, DetectedField & FieldMappingResult
│   │   └── autofill.ts           # AutofillStatus, AutofillDecision & AutofillResult
│   ├── utils/
│   │   ├── normalize.ts          # Skills normalization & formatting
│   │   ├── normalize-field.ts    # Text & identifier normalization
│   │   └── validation.ts         # Profile form validators
│   ├── background/
│   │   └── service-worker.ts     # MV3 background service worker
│├── public/
│   └── icons/                    # Source PNG icons (16x16, 48x48, 128x128)
├── tests/
│   └── forms/
│       └── basic-form.html       # Local test page with diverse form controls & safeguards
├── scripts/
│   ├── generate-icons.js         # Valid binary PNG generator
│   ├── test-profile.js           # M2 Profile behavioral unit test suite (13 tests)
│   ├── test-field-detector.js    # M3A Field detector test suite (16 tests)
│   ├── test-field-mapping.js     # M3B Field mapping & confidence test suite (30 tests)
│   ├── test-autofill.js          # M4 Safe autofill engine test suite (36 tests)
│   └── verify-extension.js       # Manifest V3 & asset verification suite
├── manifest.json                 # Manifest V3 configuration
├── package.json                  # Scripts & minimal devDependencies
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build & bundle configuration
├── README.md                     # Project documentation
└── .gitignore                    # Version control ignores
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
│   └── content.js                # Bundled content script (detector + mapper + autofill)
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
To verify all 95 automated behavioral tests across M2, M3A, M3B, and M4:
```bash
npm test
```

### 4. Build Extension
To run icon generation, all behavioral tests, TypeScript typechecking, Vite bundling, and extension verification:
```bash
npm run build
```

### 5. Development Mode
To auto-recompile on file changes:
```bash
npm run dev
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

### 2. Save a Test Profile
1. Click the FILLO puzzle piece icon in the Chrome toolbar and pin **FILLO**.
2. Open the FILLO popup.
3. Fill in your test profile details (e.g. Full Name, Email, Phone, College, Degree, Branch, CGPA, Graduation Year, GitHub, LinkedIn, Portfolio, Skills, Location).
4. Click **Save Profile**. Notice the confirmation badge.

### 3. Verify Safe Autofill on Test Form
1. Open the local test page in Chrome:
   ```text
   file:///g:/Projects/Filloo/tests/forms/basic-form.html
   ```
2. Observe that:
   - **Eligible fields** (Full Name, Email, Phone, College, Degree, Branch, CGPA, Graduation Year, GitHub, LinkedIn, Portfolio, Skills, City) are automatically populated with your saved profile data.
   - **Negative tests** (`Company Name`, `Emergency Contact`, `Username`, generic `Name`) remain completely untouched.
   - **Control safeguards** (prefilled email, disabled full name, readonly phone, account password) remain completely untouched.
3. Open Chrome Developer Tools (**F12** or **Right-Click -> Inspect**), and select the **Console** tab:
   - Observe the safe logs:
     ```text
     [FILLO] Local profile loaded successfully.
     [FILLO] Initial scan: Detected 21 form field(s).
     [FILLO] Autofilled: personal.fullName (high confidence)
     [FILLO] Autofilled: personal.email (high confidence)
     [FILLO] Skipped field: existing user value
     [FILLO] Skipped field: disabled field
     [FILLO] Skipped field: readonly field
     [FILLO] Skipped field: password field
     ```
   - Verify that **zero** profile values (e.g. your actual name or email) appear in the console logs.
4. Click **Add Dynamic GitHub Field**:
   - Observe that the dynamic field is detected and autofilled, while existing fields are not re-filled.
