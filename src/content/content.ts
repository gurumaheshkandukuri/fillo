/**
 * FILLO Content Script (Milestone 5: Real-World Form Compatibility & Autofill UX)
 * Coordinates field detection, semantic mapping, and user-triggered profile autofill.
 * Strictly adheres to privacy-first, local-first safety rules:
 * - NO automatic autofill on page load or mutation.
 * - DOM value modification occurs ONLY upon user confirmation ("Fill with FILLO").
 * - Zero profile values leaked in logs or messages.
 */

import { FieldDetector } from './field-detector.ts';
import { DynamicFormObserver } from './mutation-observer.ts';
import type { DetectedField } from '../types/field.ts';
import type { Profile } from '../types/profile.ts';
import type { AutofillMessage } from '../types/autofill.ts';
import { mapField } from '../mapping/mapper.ts';
import { getProfile, STORAGE_KEY } from '../storage/profile-storage.ts';
import { AutofillController } from '../autofill/autofill-controller.ts';

let currentProfile: Profile | null = null;
let detector: FieldDetector;
let observer: DynamicFormObserver;
let controller: AutofillController;

/**
 * Logs detected fields and semantic mappings for debugging.
 * Does NOT modify DOM values.
 * NEVER logs personal profile values or filled values.
 */
function logDetectedFields(
  fields: DetectedField[],
  context: 'Initial scan' | 'Dynamic update' | 'Route change'
): void {
  if (fields.length === 0) {
    console.log(`[FILLO] ${context}: No form fields found.`);
    return;
  }

  console.log(`[FILLO] ${context}: Detected ${fields.length} form field(s).`);

  fields.forEach((field, idx) => {
    const meta = field.metadata;
    const mapping = mapField(meta);

    console.log(
      `  [#${idx + 1}] <${meta.tagName}> type="${meta.type}" name="${meta.name || '(none)'}" label="${
        meta.labelText || '(none)'
      }" -> Mapped: ${mapping.profileField || '(unmapped)'} (${mapping.confidenceLevel}, ${(
        mapping.confidence * 100
      ).toFixed(0)}%)`
    );
  });
}

/**
 * Monitors SPA route changes via History API and popstate events.
 * Safely invalidates stale field inventory and rescans the current page.
 * Strictly avoids automatic autofill on route transitions.
 */
function setupRouteListener(onRouteChanged: () => void): void {
  let routeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  const triggerRouteChange = () => {
    if (routeDebounceTimer) {
      clearTimeout(routeDebounceTimer);
    }
    routeDebounceTimer = setTimeout(() => {
      routeDebounceTimer = null;
      onRouteChanged();
    }, 200);
  };

  // 1. Intercept history.pushState
  if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      triggerRouteChange();
      return result;
    };
  }

  // 2. Intercept history.replaceState
  if (typeof window !== 'undefined' && window.history && typeof window.history.replaceState === 'function') {
    const originalReplaceState = window.history.replaceState;
    window.history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      triggerRouteChange();
      return result;
    };
  }

  // 3. Listen to popstate (back/forward navigation)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('popstate', () => {
      triggerRouteChange();
    });
  }
}

/**
 * Initializes field detection, dynamic observer, and messaging handlers.
 */
async function init(): Promise<void> {
  detector = new FieldDetector();
  controller = new AutofillController(detector);

  // Load local profile from chrome.storage.local
  try {
    currentProfile = await getProfile();
    if (!currentProfile) {
      console.log('[FILLO] No local profile found.');
    } else {
      console.log('[FILLO] Local profile loaded successfully.');
    }
  } catch {
    console.warn('[FILLO] Could not load local profile.');
  }

  // 1. Initial scan on document ready (inspection only — no DOM modification)
  const initialFields = detector.scan();
  logDetectedFields(initialFields, 'Initial scan');

  // 2. Setup dynamic form observer for client-rendered SPA / React additions
  observer = new DynamicFormObserver(detector, (newlyAddedFields) => {
    logDetectedFields(newlyAddedFields, 'Dynamic update');
  });

  if (document.body) {
    observer.start(document.body);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.start(document.body);
    });
  }

  // 3. Setup SPA route change listener (prunes stale fields and rescans; never autofills)
  setupRouteListener(() => {
    detector.pruneStaleFields();
    const currentFields = detector.scan();
    logDetectedFields(currentFields, 'Route change');
  });

  // 4. Listen for profile updates from popup (e.g. user saves profile)
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        currentProfile = (changes[STORAGE_KEY].newValue as Profile) || null;
        if (currentProfile) {
          console.log('[FILLO] Local profile updated.');
        }
      }
    });
  }

  // 5. Listen for user actions and status requests from popup with strict type validation
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!message || typeof message !== 'object' || !('type' in message)) {
        sendResponse({ error: 'Invalid message payload' });
        return false;
      }

      const typedMessage = message as AutofillMessage;

      if (typedMessage.type === 'GET_AUTOFILL_STATUS') {
        const summary = controller.getStatus(currentProfile);
        sendResponse(summary);
        return false;
      }

      if (typedMessage.type === 'EXECUTE_AUTOFILL') {
        // Crucial security guarantee: never accept profile data over messaging.
        // Always use locally loaded currentProfile.
        const result = controller.executeAutofill(currentProfile);
        sendResponse(result);
        return false;
      }

      // Reject unknown message types safely
      sendResponse({ error: 'Unknown message type' });
      return false;
    });
  }
}

// Start once page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch(console.error);
  });
} else {
  init().catch(console.error);
}
