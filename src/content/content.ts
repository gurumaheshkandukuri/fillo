/**
 * FILLO Content Script (Milestone 4: Safe Autofill Engine)
 * Coordinates field detection, semantic mapping, and safe profile autofill.
 * Strictly adheres to privacy-first, local-first safety rules.
 */

import { FieldDetector } from './field-detector.ts';
import { DynamicFormObserver } from './mutation-observer.ts';
import type { DetectedField } from '../types/field.ts';
import type { Profile } from '../types/profile.ts';
import { mapField } from '../mapping/mapper.ts';
import { getProfile, STORAGE_KEY } from '../storage/profile-storage.ts';
import { autofillField } from '../autofill/autofill-engine.ts';

let currentProfile: Profile | null = null;
let detector: FieldDetector;
let observer: DynamicFormObserver;

/**
 * Processes detected form fields, evaluates semantic mappings, and safely autofills
 * eligible fields when a valid local profile is present.
 * NEVER logs personal profile values or filled values to console.
 */
function processDetectedFields(
  fields: DetectedField[],
  context: 'Initial scan' | 'Dynamic update'
): void {
  if (fields.length === 0) {
    console.log(`[FILLO] ${context}: No form fields found.`);
    return;
  }

  console.log(`[FILLO] ${context}: Detected ${fields.length} form field(s).`);

  fields.forEach((field, idx) => {
    const meta = field.metadata;
    const mapping = mapField(meta);

    // 1. Safe detection and mapping debug log
    console.log(
      `  [#${idx + 1}] <${meta.tagName}> type="${meta.type}" name="${meta.name || '(none)'}" label="${
        meta.labelText || '(none)'
      }" -> Mapped: ${mapping.profileField || '(unmapped)'} (${mapping.confidenceLevel}, ${(
        mapping.confidence * 100
      ).toFixed(0)}%)`
    );

    // 2. Safe autofill attempt if profile is available
    if (currentProfile) {
      const autofillResult = autofillField(field, mapping, currentProfile);

      if (autofillResult.status === 'filled') {
        // Privacy safe: log only field key, never the value
        console.log(`[FILLO] Autofilled: ${autofillResult.profileField} (high confidence)`);
      } else {
        console.log(`[FILLO] Skipped field: ${autofillResult.reason}`);
      }
    }
  });
}

/**
 * Initializes field detection and safe autofill lifecycle.
 */
async function init(): Promise<void> {
  detector = new FieldDetector();

  // Load local profile from chrome.storage.local
  try {
    currentProfile = await getProfile();
    if (!currentProfile) {
      console.log('[FILLO] No local profile found. Autofill inactive.');
    } else {
      console.log('[FILLO] Local profile loaded successfully.');
    }
  } catch {
    console.warn('[FILLO] Could not load local profile.');
  }

  // 1. Initial scan on document ready
  const initialFields = detector.scan();
  processDetectedFields(initialFields, 'Initial scan');

  // 2. Setup dynamic form observer for client-rendered SPA / React additions
  observer = new DynamicFormObserver(detector, (newlyAddedFields) => {
    processDetectedFields(newlyAddedFields, 'Dynamic update');
  });

  if (document.body) {
    observer.start(document.body);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.start(document.body);
    });
  }

  // 3. Listen for profile updates from popup (e.g. user saves profile)
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        currentProfile = (changes[STORAGE_KEY].newValue as Profile) || null;
        if (currentProfile) {
          console.log('[FILLO] Local profile updated. Scanning fields...');
          const currentFields = detector.scan();
          processDetectedFields(currentFields, 'Dynamic update');
        }
      }
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
