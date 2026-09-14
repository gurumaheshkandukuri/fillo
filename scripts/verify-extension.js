import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

console.log('----------------------------------------------------');
console.log('🔍 Running FILLO Extension Verification Suite...');
console.log('----------------------------------------------------');

let errorCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    errorCount++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// 1. Verify dist folder exists
assert(fs.existsSync(distDir), 'Output directory "dist" exists');

// 2. Verify dist/src does NOT exist (no nested src artifact)
const distSrc = path.join(distDir, 'src');
assert(!fs.existsSync(distSrc), 'Clean dist structure: no nested "dist/src" folder exists');

// 3. Verify dist/manifest.json
const manifestPath = path.join(distDir, 'manifest.json');
assert(fs.existsSync(manifestPath), 'dist/manifest.json exists');

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert(true, 'dist/manifest.json is valid JSON');
} catch (e) {
  assert(false, `dist/manifest.json failed to parse: ${e.message}`);
}

if (manifest) {
  // 4. Validate Manifest V3 requirements
  assert(manifest.manifest_version === 3, 'manifest_version is 3');
  assert(manifest.name === 'FILLO', 'Extension name is "FILLO"');
  assert(typeof manifest.description === 'string' && manifest.description.length > 0, 'Description is provided');

  // 5. Verify action and popup
  assert(manifest.action && typeof manifest.action === 'object', 'action object is configured');
  if (manifest.action) {
    const popupPath = manifest.action.default_popup;
    assert(typeof popupPath === 'string', 'action.default_popup path is specified');
    const fullPopupPath = path.join(distDir, popupPath);
    assert(fs.existsSync(fullPopupPath), `Popup file exists at dist/${popupPath}`);

    // Inspect popup.html contents for references
    if (fs.existsSync(fullPopupPath)) {
      const popupHtml = fs.readFileSync(fullPopupPath, 'utf-8');
      assert(popupHtml.includes('FILLO'), 'popup.html contains "FILLO" header');
      assert(popupHtml.includes('Fill once. Apply anywhere.'), 'popup.html contains tagline');

      // Verify linked stylesheet and script exist
      const cssMatch = popupHtml.match(/href=["'](\.\/|\/)?([^"']+\.css)["']/);
      if (cssMatch) {
        const cssRel = cssMatch[2];
        const cssPath = path.join(path.dirname(fullPopupPath), cssRel);
        assert(fs.existsSync(cssPath), `Popup stylesheet exists at ${cssRel}`);
      }

      const jsMatch = popupHtml.match(/src=["'](\.\/|\/)?([^"']+\.js)["']/);
      if (jsMatch) {
        const jsRel = jsMatch[2];
        const jsPath = path.join(path.dirname(fullPopupPath), jsRel);
        assert(fs.existsSync(jsPath), `Popup script bundle exists at ${jsRel}`);
      }
    }
  }

  // 6. Verify service worker
  assert(manifest.background && manifest.background.service_worker, 'background.service_worker is specified');
  if (manifest.background && manifest.background.service_worker) {
    const swPath = manifest.background.service_worker;
    const fullSwPath = path.join(distDir, swPath);
    assert(fs.existsSync(fullSwPath), `Service worker file exists at dist/${swPath}`);
    assert(manifest.background.type === 'module', 'Service worker type is "module"');
  }

  // 7. Verify icons
  function verifyIcon(relPath, expectedSize) {
    const fullPath = path.join(distDir, relPath);
    if (!fs.existsSync(fullPath)) {
      assert(false, `Icon file exists at dist/${relPath}`);
      return;
    }
    const buf = fs.readFileSync(fullPath);
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const isValidPng = buf.subarray(0, 8).equals(pngSignature);
    assert(isValidPng, `dist/${relPath} is a valid binary PNG file`);

    if (isValidPng && buf.length >= 24) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      assert(width === expectedSize && height === expectedSize, `dist/${relPath} has correct dimensions (${expectedSize}x${expectedSize})`);
    }
  }

  if (manifest.icons) {
    for (const [sizeStr, iconRel] of Object.entries(manifest.icons)) {
      verifyIcon(iconRel, parseInt(sizeStr, 10));
    }
  }

  if (manifest.action && manifest.action.default_icon) {
    for (const [sizeStr, iconRel] of Object.entries(manifest.action.default_icon)) {
      verifyIcon(iconRel, parseInt(sizeStr, 10));
    }
  }

  // 8. Verify minimum permissions & content scripts (Milestone 3A)
  const permissions = manifest.permissions || [];
  assert(
    permissions.length === 1 && permissions[0] === 'storage',
    'Minimum permissions respected: only "storage" is requested in permissions'
  );
  assert(
    !manifest.host_permissions || manifest.host_permissions.length === 0,
    'Zero redundant host_permissions declared'
  );

  // 9. Verify content_scripts registration
  assert(
    Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0,
    'content_scripts is configured in manifest'
  );
  if (manifest.content_scripts && manifest.content_scripts[0]) {
    const cs = manifest.content_scripts[0];
    assert(cs.matches && cs.matches.includes('<all_urls>'), 'content_scripts matches "<all_urls>"');
    assert(cs.js && cs.js.includes('content/content.js'), 'content_scripts references "content/content.js"');
  }
}

// 10. Verify content script bundle exists in dist/content/content.js
const contentScriptPath = path.join(distDir, 'content/content.js');
assert(fs.existsSync(contentScriptPath), 'Content script bundle exists at dist/content/content.js');

console.log('----------------------------------------------------');
if (errorCount === 0) {
  console.log('🎉 ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('----------------------------------------------------');
  process.exit(0);
} else {
  console.error(`💥 VERIFICATION FAILED WITH ${errorCount} ERROR(S).`);
  console.log('----------------------------------------------------');
  process.exit(1);
}
