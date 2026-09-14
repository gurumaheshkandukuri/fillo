import { Profile, createEmptyProfile } from '../types/profile';
import { getProfile, saveProfile, clearProfile } from '../storage/profile-storage';
import { validateProfile } from '../utils/validation';
import { normalizeSkills, formatSkillsForDisplay } from '../utils/normalize';

// DOM Elements
const form = document.getElementById('profile-form') as HTMLFormElement;
const statusBanner = document.getElementById('status-banner') as HTMLDivElement;
const modalOverlay = document.getElementById('modal-overlay') as HTMLDivElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnModalCancel = document.getElementById('btn-modal-cancel') as HTMLButtonElement;
const btnModalConfirm = document.getElementById('btn-modal-confirm') as HTMLButtonElement;

// Form Input Elements
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

function showStatus(message: string, type: 'success' | 'error') {
  if (bannerTimeout) {
    clearTimeout(bannerTimeout);
    bannerTimeout = null;
  }

  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${type}`;

  // Keep success message visible for 3.5 seconds
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
    // Map 'personal.email' -> 'error-personal-email' or 'education.cgpa' -> 'error-education-cgpa'
    const errorId = `error-${key.replace('.', '-')}`;
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.add('active');
    }

    // Add error highlight to corresponding input
    const fieldName = key.split('.')[1] || key;
    const inputEl = (inputs as Record<string, HTMLElement>)[fieldName];
    if (inputEl) {
      inputEl.classList.add('has-error');
    }
  }
}

/**
 * Populates form inputs from a Profile object.
 */
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

/**
 * Reads form inputs and returns a structured Profile object.
 */
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

/**
 * Initialize popup: load profile and attach event listeners.
 */
async function init() {
  try {
    const saved = await getProfile();
    if (saved) {
      populateForm(saved);
    } else {
      populateForm(createEmptyProfile());
    }
  } catch {
    showStatus('Failed to load saved profile.', 'error');
  }

  // Handle Save
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
      showStatus('✓ Profile saved locally', 'success');
    } catch {
      showStatus('Error saving profile to local storage.', 'error');
    }
  });

  // Handle Clear Profile confirmation workflow
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
      populateForm(createEmptyProfile());
      showStatus('✓ Profile cleared locally', 'success');
    } catch {
      showStatus('Failed to clear stored profile.', 'error');
    }
  });
}

// Mount when DOM is ready
document.addEventListener('DOMContentLoaded', init);
