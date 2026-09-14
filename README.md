# FILLO

> **Fill once. Apply anywhere.**

FILLO is a privacy-first Chrome browser extension designed to intelligently autofill repetitive web forms using a user's locally stored profile.

---

## Milestone 1: Clean Extension Skeleton

This milestone establishes the foundational Chrome Manifest V3 project skeleton. It contains:
- Strict **Manifest V3** compliance.
- Fast, modern TypeScript bundling with **Vite**.
- Minimal, clean, professional **Popup UI**.
- Minimal safe **Background Service Worker** (ES Module).
- Minimal safe **Content Script** skeleton.
- Valid binary **PNG Icons** in required sizes (16x16, 48x48, 128x128).
- Zero unnecessary dependencies, frameworks, or broad permissions.

---

## Directory Structure

```
fillo/
├── src/
│   ├── popup/
│   │   ├── popup.html            # Popup markup
│   │   ├── popup.ts              # Popup lifecycle & logic
│   │   └── popup.css             # Clean, modern styles
│   ├── background/
│   │   └── service-worker.ts     # MV3 service worker
│   └── content/
│       └── content.ts            # Content script skeleton
├── public/
│   └── icons/                    # Source PNG icons
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── scripts/
│   ├── generate-icons.js         # Valid binary PNG generator
│   └── verify-extension.js       # Programmatic validation suite
├── manifest.json                 # Source Manifest V3
├── package.json                  # Scripts & dependencies
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build & bundle configuration
├── README.md                     # Project documentation
└── .gitignore                    # Version control ignores
```

---

## Build Output (`dist/`)

When built, Vite produces the exact, clean extension directory required by Chrome:

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

### 3. Build Extension
To compile TypeScript, bundle assets, and produce the `dist/` directory:
```bash
npm run build
```

This runs:
1. `generate-icons`: Generates valid binary PNG icons.
2. `tsc --noEmit`: Type checks all TypeScript source files.
3. `vite build`: Bundles the popup, background service worker, and content script into `dist/`.
4. `verify-extension`: Programmatically validates the `dist/` directory against Manifest V3 and checks asset existence.

### 4. Development Mode
To auto-recompile on file changes during development:
```bash
npm run dev
```

---

## How to Load into Google Chrome

Follow these exact steps to load and test FILLO in Chrome:

1. Open **Google Chrome**.
2. In the URL address bar, navigate to:
   ```text
   chrome://extensions
   ```
3. In the top-right corner of the Extensions page, toggle **Developer mode** to **ON**.
4. In the top-left toolbar that appears, click the **Load unpacked** button.
5. In the file picker dialog, select the `dist` folder located at:
   ```text
   g:\Projects\Filloo\dist
   ```
   *(Ensure you select the `dist` folder itself, not the project root)*.
6. Click **Select Folder**.
7. **FILLO** will now appear in your list of installed extensions with version `0.1.0`.
8. Click the Chrome toolbar **puzzle piece icon** (Extensions menu) and pin **FILLO**.
9. Click the FILLO icon to open the popup:
   - You will see the brand title **FILLO**.
   - You will see the tagline **Fill once. Apply anywhere.**
   - You will see the **Local profile ready** indicator and **Privacy-first** badge.

---

## Roadmap

- [x] **Milestone 1**: Clean Manifest V3 extension skeleton & Vite build pipeline.
- [ ] **Milestone 2**: Local encrypted profile data storage (`chrome.storage.local`).
- [ ] **Milestone 3**: Web form field detection heuristics.
- [ ] **Milestone 4**: Privacy-first local autofill engine.
