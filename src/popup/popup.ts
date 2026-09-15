/**
 * FILLO Popup Lifecycle & Controller Integration (Milestone 5)
 * Handles tab navigation, profile management, active tab status querying, and user-triggered autofill.
 * Strictly avoids logging or displaying personal profile values in UI summaries or console.
 */

import type { Profile } from '../types/profile.ts';
import { createEmptyProfile } from '../types/profile.ts';
import type { AutofillStatusSummary, AutofillExecutionSummary } from '../types/autofill.ts';
import { getProfile, saveProfile, clearProfile } from '../storage/profile-storage.ts';
import { validateProfile } from '../utils/validation.ts';
import { normalizeSkills, formatSkillsForDisplay } from '../utils/normalize.ts';

// UI Elements: Tabs & Panels
const tabBtnAutofill = document.getElementById('tab-btn-autofill') as HTMLButtonElement;
const tabBtnProfile = document.getElementById('tab-btn-profile') as HTMLButtonElement;
const viewAutofill = document.getElementById('view-autofill') as HTMLElement;
const viewProfile = document.getElementById('view-profile') as HTMLElement;
const statusBanner = document.getElementById('status-banner') as HTMLDivElement;

// Autofill View Elements
const metricDetected = document.getElementById('metric-detected') as HTMLSpanElement;
const metricReady = document.getElementById('metric-ready') as HTMLSpanElement;
const autofillStatusText = document.getElementById('autofill-status-text') as HTMLDivElement;
const profileIndicator = document.getElementById('profile-indicator') as HTMLSpanElement;
const btnGotoProfile = document.getElementById('btn-goto-profile') as HTMLButtonElement;
const btnFill = document.getElementById('btn-fill') as HTMLButtonElement;

// Fill Result Elements
const fillResultContainer = document.getElementById('fill-result-container') as HTMLDivElement;
const fillResultHeader = document.getElementById('fill-result-header') as HTMLDivElement;
const fillSkippedContainer = document.getElementById('fill-skipped-container') as HTMLDivElement;
const fillSkippedItems = document.getElementById('fill-skipped-items') as HTMLUListElement;

// Profile Form Elements (M2)
const form = document.getElementById('profile-form') as HTMLFormElement;
const modalOverlay = document.getElementById('modal-overlay') as HTMLDivElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnModalCancel = document.getElementById('btn-modal-cancel') as HTMLButtonElement;
const btnModalConfirm = document.getElementById('btn-modal-confirm') as HTMLButtonElement;

const inputs = {
  fullName: document.getElementById('fullName') as HTMLInputElement,
  firstName: document.getElementById('firstName') as HTMLInputElement,
  lastName: document.getElementById('lastName') as HTMLInputElement,
  email: document.getElementById('email') as HTMLInputElement,
  phone: document.getElementById('phone') as HTMLInputElement,
  location: document.getElementById('location') as HTMLInputElement,
  college: document.getElementById('college') as HTMLInputElement,
  degree: document.getElementById('degree') as HTMLInputElement,
  branch: document.getElementById('branch') as HTMLInputElement,
  cgpa: document.getElementById('cgpa') as HTMLInputElement,
  graduationYear: document.getElementById('graduationYear') as HTMLInputElement,
  github: document.getElementById('github') as HTMLInputElement,
  linkedin: document.getElementById('linkedin') as HTMLInputElement,
  portfolio: document.getElementById('portfolio') as HTMLInputElement,
  skills: document.getElementById('skills') as HTMLTextAreaElement,
};

let bannerTimeout: ReturnType<typeof setTimeout> | null = null;
let currentProfile: Profile | null = null;

// ============================================================================
// TAB NAVIGATION
// ============================================================================

function switchTab(tab: 'autofill' | 'profile') {
  if (tab === 'autofill') {
    tabBtnAutofill.classList.add('active');
    tabBtnAutofill.setAttribute('aria-selected', 'true');
    tabBtnProfile.classList.remove('active');
    tabBtnProfile.setAttribute('aria-selected', 'false');

    viewAutofill.classList.remove('hidden');
    viewProfile.classList.add('hidden');
  } else {
    tabBtnProfile.classList.add('active');
    tabBtnProfile.setAttribute('aria-selected', 'true');
    tabBtnAutofill.classList.remove('active');
    tabBtnAutofill.setAttribute('aria-selected', 'false');

    viewProfile.classList.remove('hidden');
    viewAutofill.classList.add('hidden');
  }
}

tabBtnAutofill.addEventListener('click', () => switchTab('autofill'));
tabBtnProfile.addEventListener('click', () => switchTab('profile'));
btnGotoProfile.addEventListener('click', () => switchTab('profile'));

// ============================================================================
// STATUS & BANNER HELPERS
// ============================================================================

function showStatus(message: string, type: 'success' | 'error') {
  if (bannerTimeout) {
    clearTimeout(bannerTimeout);
    bannerTimeout = null;
  }

  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}`;

  if (type === 'success') {
    bannerTimeout = setTimeout(() => {
      statusBanner.className = 'status-banner hidden';
      statusBanner.textContent = '';
    }, 3500);
  }
}

function clearStatus() {
  if (bannerTimeout) {
    clearTimeout(bannerTimeout);
    bannerTimeout = null;
  }
  statusBanner.className = 'status-banner hidden';
  statusBanner.textContent = '';
}

// ============================================================================
// AUTOFILL VIEW LOGIC
// ============================================================================

function updateAutofillUI(
  summary: AutofillStatusSummary | { detectedCount: number; eligibleCount: number; ready: boolean; profileReady: boolean; message?: string }
) {
  metricDetected.textContent = String(summary.detectedCount);
  metricReady.textContent = String(summary.eligibleCount);

  if (summary.profileReady) {
    profileIndicator.textContent = 'Profile: ✓ Ready';
    profileIndicator.className = 'status-indicator ready';
    btnGotoProfile.textContent = 'Edit Profile';
  } else {
    profileIndicator.textContent = 'Profile: ⚠ Not set up';
    profileIndicator.className = 'status-indicator not-ready';
    btnGotoProfile.textContent = 'Set Up Profile';
  }

  if (!summary.profileReady) {
    autofillStatusText.textContent = 'Set up your profile to enable autofill.';
    btnFill.disabled = true;
  } else if (summary.detectedCount === 0) {
    autofillStatusText.textContent = (summary as any).message || 'No form fields detected on this page.';
    btnFill.disabled = true;
  } else if (summary.eligibleCount === 0) {
    autofillStatusText.textContent = 'No eligible fields ready to fill.';
    btnFill.disabled = true;
  } else {
    autofillStatusText.textContent = `${summary.eligibleCount} field(s) ready to safely fill.`;
    btnFill.disabled = false;
  }
}

/**
 * Queries active tab content script for detected form status.
 */
function refreshActiveTabStatus() {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
    updateAutofillUI({
      detectedCount: 0,
      eligibleCount: 0,
      ready: false,
      profileReady: Boolean(currentProfile),
      message: 'Extension environment unavailable.',
    });
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab?.id) {
      updateAutofillUI({
        detectedCount: 0,
        eligibleCount: 0,
        ready: false,
        profileReady: Boolean(currentProfile),
        message: 'No active webpage.',
      });
      return;
    }

    chrome.tabs.sendMessage(
      activeTab.id,
      { type: 'GET_AUTOFILL_STATUS' },
      (response: AutofillStatusSummary) => {
        if (chrome.runtime.lastError || !response) {
          updateAutofillUI({
            detectedCount: 0,
            eligibleCount: 0,
            ready: false,
            profileReady: Boolean(currentProfile),
            message: 'No supported form detected on this page.',
          });
          return;
        }

        updateAutofillUI(response);
      }
    );
  });
}

/**
 * Renders the compact result summary after user clicks "Fill with FILLO".
 * Never logs or exposes user profile values.
 */
function renderExecutionSummary(summary: AutofillExecutionSummary) {
  fillResultContainer.classList.remove('hidden');

  if (summary.filled > 0) {
    fillResultHeader.textContent = `✓ FILLO filled ${summary.filled} field(s)`;
    fillResultHeader.className = 'fill-result-header';
  } else {
    fillResultHeader.textContent = 'No fields were safely filled.';
    fillResultHeader.className = 'fill-result-header empty';
  }

  // Populate skipped items if any
  if (summary.skippedReasons && summary.skippedReasons.length > 0) {
    fillSkippedContainer.classList.remove('hidden');
    fillSkippedItems.innerHTML = '';

    summary.skippedReasons.forEach((item) => {
      const li = document.createElement('li');
      const labelSpan = document.createElement('span');
      labelSpan.className = 'skip-label';
      labelSpan.textContent = `• ${item.labelOrField}`;

      const reasonSpan = document.createElement('span');
      reasonSpan.className = 'skip-reason';
      reasonSpan.textContent = `(${item.reason})`;

      li.appendChild(labelSpan);
      li.appendChild(reasonSpan);
      fillSkippedItems.appendChild(li);
    });
  } else {
    fillSkippedContainer.classList.add('hidden');
  }

  // Update ready count to 0 (already filled)
  metricReady.textContent = '0';
  btnFill.disabled = true;
  autofillStatusText.textContent = 'Autofill complete.';
}

// Handle "Fill with FILLO" click
btnFill.addEventListener('click', () => {
  btnFill.disabled = true;
  btnFill.textContent = 'Filling...';

  if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
    btnFill.textContent = 'Fill with FILLO';
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab?.id) {
      btnFill.textContent = 'Fill with FILLO';
      return;
    }

    chrome.tabs.sendMessage(
      activeTab.id,
      { type: 'EXECUTE_AUTOFILL' },
      (response: AutofillExecutionSummary) => {
        btnFill.textContent = 'Fill with FILLO';

        if (chrome.runtime.lastError || !response) {
          showStatus('Could not communicate with page.', 'error');
          return;
        }

        renderExecutionSummary(response);
      }
    );
  });
});

// ============================================================================
// PROFILE FORM MANAGEMENT (M2)
// ============================================================================

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach((el) => {
    el.textContent = '';
    el.classList.remove('active');
  });
  document.querySelectorAll('input.has-error, textarea.has-error').forEach((el) => {
    el.classList.remove('has-error');
  });
}

function displayFieldErrors(errors: Record<string, string>) {
  clearFieldErrors();
  for (const [key, msg] of Object.entries(errors)) {
    const errorId = `error-${key.replace('.', '-')}`;
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.add('active');
    }

    const fieldName = key.split('.')[1] || key;
    const inputEl = (inputs as Record<string, HTMLElement>)[fieldName];
    if (inputEl) {
      inputEl.classList.add('has-error');
    }
  }
}

function populateForm(profile: Profile) {
  inputs.fullName.value = profile.personal.fullName || '';
  inputs.firstName.value = profile.personal.firstName || '';
  inputs.lastName.value = profile.personal.lastName || '';
  inputs.email.value = profile.personal.email || '';
  inputs.phone.value = profile.personal.phone || '';
  inputs.location.value = profile.personal.location || '';

  inputs.college.value = profile.education.college || '';
  inputs.degree.value = profile.education.degree || '';
  inputs.branch.value = profile.education.branch || '';
  inputs.cgpa.value = profile.education.cgpa || '';
  inputs.graduationYear.value = profile.education.graduationYear || '';

  inputs.github.value = profile.online.github || '';
  inputs.linkedin.value = profile.online.linkedin || '';
  inputs.portfolio.value = profile.online.portfolio || '';

  inputs.skills.value = formatSkillsForDisplay(profile.skills);
}

function readForm(): Profile {
  return {
    personal: {
      fullName: inputs.fullName.value.trim(),
      firstName: inputs.firstName.value.trim(),
      lastName: inputs.lastName.value.trim(),
      email: inputs.email.value.trim(),
      phone: inputs.phone.value.trim(),
      location: inputs.location.value.trim(),
    },
    education: {
      college: inputs.college.value.trim(),
      degree: inputs.degree.value.trim(),
      branch: inputs.branch.value.trim(),
      cgpa: inputs.cgpa.value.trim(),
      graduationYear: inputs.graduationYear.value.trim(),
    },
    online: {
      github: inputs.github.value.trim(),
      linkedin: inputs.linkedin.value.trim(),
      portfolio: inputs.portfolio.value.trim(),
    },
    skills: normalizeSkills(inputs.skills.value),
  };
}

// Handle Form Save
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearStatus();
  clearFieldErrors();

  const profile = readForm();
  const validation = validateProfile(profile);

  if (!validation.isValid) {
    displayFieldErrors(validation.errors);
    showStatus('Please fix the highlighted errors.', 'error');
    return;
  }

  try {
    await saveProfile(profile);
    currentProfile = profile;
    showStatus('✓ Profile saved locally', 'success');

    // Refresh autofill status so readiness recalculates
    refreshActiveTabStatus();
  } catch {
    showStatus('Error saving profile to local storage.', 'error');
  }
});

// Clear Profile Workflow
btnClear.addEventListener('click', () => {
  modalOverlay.classList.remove('hidden');
});

btnModalCancel.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

btnModalConfirm.addEventListener('click', async () => {
  modalOverlay.classList.add('hidden');
  clearFieldErrors();
  try {
    await clearProfile();
    currentProfile = null;
    populateForm(createEmptyProfile());
    showStatus('✓ Profile cleared locally', 'success');

    refreshActiveTabStatus();
  } catch {
    showStatus('Failed to clear stored profile.', 'error');
  }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  try {
    currentProfile = await getProfile();
    if (currentProfile) {
      populateForm(currentProfile);
    } else {
      populateForm(createEmptyProfile());
    }
  } catch {
    showStatus('Failed to load saved profile.', 'error');
  }

  refreshActiveTabStatus();
}

document.addEventListener('DOMContentLoaded', init);
