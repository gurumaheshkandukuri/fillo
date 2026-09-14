# FILLO

> **Fill once. Apply anywhere.**

FILLO is a privacy-first Chrome browser extension designed to intelligently autofill repetitive web forms using a user's locally stored profile.

---

## Milestone Status

- [x] **Milestone 1**: Clean Manifest V3 extension skeleton & Vite build pipeline.
- [x] **Milestone 2**: Local profile management system using `chrome.storage.local`.
- [ ] **Milestone 3**: Web form field detection heuristics.
- [ ] **Milestone 4**: Privacy-first local autofill engine.

---

## Milestone 2: Profile System

In Milestone 2, FILLO supports complete local profile management:
- **Centralized Data Model**: Strongly typed TypeScript profile schema (`src/types/profile.ts`).
- **Structured Skills**: Normalized skill arrays (`skills: string[]`) parsed from comma/newline-separated input with whitespace trimming and case-insensitive deduplication.
- **Dedicated Storage Module**: `src/storage/profile-storage.ts` provides `saveProfile`, `getProfile`, and `clearProfile` interfacing solely with `chrome.storage.local` under the `"filloProfile"` key.
- **Form UI**: Logical section cards for Personal Information, Education, Online Profiles, and Skills.
- **Lightweight Validation**: Sensible optional field validators (email, phone, URLs, CGPA, graduation year) with inline field-specific error highlights.
- **Safe Clear Flow**: Modal confirmation dialog before clearing stored profile data to prevent accidental loss.
- **Strict Privacy**: Zero remote API calls, zero telemetry, zero analytics, and zero profile data logged in console.

---

## Directory Structure

```
fillo/
├── src/
│   ├── popup/
│   │   ├── popup.html            # Profile form & clear confirmation modal
│   │   ├── popup.ts              # Form handling, validation, DOM lifecycle
│   │   └── popup.css             # Sleek dark-slate extension styling
│   ├── storage/
│   │   └── profile-storage.ts    # Dedicated chrome.storage.local wrapper
│   ├── types/
│   │   └── profile.ts            # Strongly typed Profile interface
│   ├── utils/
│   │   ├── validation.ts         # Optional field validators
│   │   └── normalize.ts          # Skills normalization & formatting
│   ├── background/
│   │   └── service-worker.ts     # MV3 background service worker
│   └── content/
│       └── content.ts            # Content script skeleton
├── public/
│   └── icons/                    # Source PNG icons (16x16, 48x48, 128x128)
├── scripts/
│   ├── generate-icons.js         # Valid binary PNG generator
│   ├── test-profile.js           # Behavioral unit test suite
│   └── verify-extension.js       # Manifest V3 & asset verification suite
├── manifest.json                 # Manifest V3 configuration (storage permission only)
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
│   └── content.js
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
To verify profile normalization, validation rules, and schema defaults:
```bash
npm test
```

### 4. Build Extension
To run icon generation, behavioral tests, TypeScript typechecking, Vite bundling, and extension verification:
```bash
npm run build
```

### 5. Development Mode
To auto-recompile on file changes:
```bash
npm run dev
```

---

## How to Load into Google Chrome

1. Open **Google Chrome**.
2. In the URL address bar, navigate to:
   ```text
   chrome://extensions
   ```
3. In the top-right corner of the Extensions page, toggle **Developer mode** to **ON**.
4. In the top-left toolbar, click the **Load unpacked** button.
5. In the file picker dialog, select the `dist` folder located at:
   ```text
   g:\Projects\Filloo\dist
   ```
   *(Ensure you select the `dist` folder itself, not the project root)*.
6. Click **Select Folder**.
7. **FILLO** (`v0.1.0`) will appear in your list of loaded extensions with zero errors or warnings.
8. Click the Chrome toolbar **puzzle piece icon** (Extensions menu) and pin **FILLO**.
9. Click the FILLO icon to open the profile popup:
   - Enter your personal, education, online profiles, and skills.
   - Click **Save Profile** to persist data locally.
   - Reopen the popup at any time to verify data retention.
