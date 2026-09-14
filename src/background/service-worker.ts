/**
 * FILLO - Background Service Worker (Manifest V3)
 * Minimal safe initialization for extension lifecycle events.
 */

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[FILLO] Background service worker initialized.', details.reason);
});
