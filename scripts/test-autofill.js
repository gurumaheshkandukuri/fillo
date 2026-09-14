/**
 * FILLO Milestone 4: Safe Autofill Engine Behavioral Tests
 * Comprehensive behavioral test suite verifying safety gates, input types, select handling,
 * event dispatching, profile value extraction, privacy preservation, and regression checks.
 */

import assert from 'assert';
import { AutofillEngine, autofillField } from '../src/autofill/autofill-engine.ts';
import { checkAutofillSafety } from '../src/autofill/safety-gate.ts';
import { getProfileValue } from '../src/autofill/profile-value.ts';
import { writeInputValue, writeSelectValue } from '../src/autofill/value-writer.ts';
import { mapField } from '../src/mapping/mapper.ts';
import { validateProfile } from '../src/utils/validation.ts';
import { normalizeSkills } from '../src/utils/normalize.ts';
import { normalizeFieldText } from '../src/utils/normalize-field.ts';
import { createEmptyProfile } from '../src/types/profile.ts';

console.log('----------------------------------------------------');
console.log('🧪 Running FILLO Milestone 4 Safe Autofill Behavioral Tests...');
console.log('----------------------------------------------------');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
    failedTests++;
  }
}

/**
 * Lightweight mock DOM Element for behavioral testing without external browser dependencies.
 */
class MockElement {
  constructor(tagName = 'input', attrs = {}) {
    this.tagName = tagName.toUpperCase();
    this.attrs = new Map();
    this.children = [];
    this.parentElement = null;
    this.disabled = false;
    this.readOnly = false;
    this.hidden = false;
    this._value = '';
    this.eventListeners = new Map();
    this.dispatchedEvents = [];
    this.options = [];
    this.selectedIndex = -1;

    for (const [k, v] of Object.entries(attrs)) {
      this.setAttribute(k, v);
    }
  }

  get type() {
    return this.attrs.get('type') || (this.tagName === 'TEXTAREA' ? 'textarea' : this.tagName === 'SELECT' ? 'select-one' : 'text');
  }

  set type(val) {
    this.attrs.set('type', val);
  }

  get value() {
    if (this.tagName === 'SELECT') {
      if (this.selectedIndex >= 0 && this.selectedIndex < this.options.length) {
        return this.options[this.selectedIndex].value;
      }
      return '';
    }
    return this._value;
  }

  set value(val) {
    if (this.tagName === 'SELECT') {
      const idx = this.options.findIndex((opt) => opt.value === val);
      this.selectedIndex = idx;
      return;
    }
    this._value = String(val);
  }

  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  setAttribute(name, value) {
    this.attrs.set(name, String(value));
    if (name === 'disabled') this.disabled = true;
    if (name === 'readonly') this.readOnly = true;
    if (name === 'hidden') this.hidden = true;
  }

  hasAttribute(name) {
    return this.attrs.has(name);
  }

  removeAttribute(name) {
    this.attrs.delete(name);
    if (name === 'disabled') this.disabled = false;
    if (name === 'readonly') this.readOnly = false;
    if (name === 'hidden') this.hidden = false;
  }

  addEventListener(type, listener) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    this.dispatchedEvents.push(event);
    const listeners = this.eventListeners.get(event.type) || [];
    for (const listener of listeners) {
      listener(event);
    }
    if (event.bubbles && this.parentElement) {
      this.parentElement.dispatchEvent(event);
    }
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
  }
}

/**
 * Creates a standard test Profile object populated with sample candidate data.
 */
function createTestProfile() {
  return {
    personal: {
      fullName: 'Alex Morgan',
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'alex.morgan@example.com',
      phone: '+1 555-0199',
      location: 'San Francisco, CA',
    },
    education: {
      college: 'Stanford University',
      degree: "Bachelor's Degree",
      branch: 'Computer Science',
      cgpa: '3.92',
      graduationYear: '2024',
    },
    online: {
      github: 'https://github.com/alexmorgan',
      linkedin: 'https://linkedin.com/in/alexmorgan',
      portfolio: 'https://alexmorgan.dev',
    },
    skills: ['TypeScript', 'React', 'Node.js', 'Python'],
  };
}

/**
 * Helper to build a DetectedField object with mock element.
 */
function createDetectedField(tagName = 'input', attrs = {}) {
  const el = new MockElement(tagName, attrs);
  return {
    element: el,
    metadata: {
      tagName: tagName.toLowerCase(),
      type: el.type,
      name: attrs.name || '',
      nameNormalized: normalizeFieldText(attrs.name || ''),
      id: attrs.id || '',
      idNormalized: normalizeFieldText(attrs.id || ''),
      placeholder: attrs.placeholder || '',
      placeholderNormalized: normalizeFieldText(attrs.placeholder || ''),
      ariaLabel: attrs['aria-label'] || '',
      ariaLabelNormalized: normalizeFieldText(attrs['aria-label'] || ''),
      ariaLabelledBy: attrs['aria-labelledby'] || '',
      autocomplete: attrs.autocomplete || '',
      autocompleteNormalized: normalizeFieldText(attrs.autocomplete || ''),
      labelText: attrs.labelText || '',
      labelTextNormalized: normalizeFieldText(attrs.labelText || ''),
      surroundingText: '',
      surroundingTextNormalized: '',
    },
  };
}

// ============================================================================
// SAFETY TESTS (1 - 10)
// ============================================================================

runTest('TEST 1: HIGH-confidence empty text field -> fills', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'candidate_email',
    labelText: 'Email Address',
    type: 'email',
    autocomplete: 'email',
  });
  const mapping = {
    profileField: 'personal.email',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['Autocomplete match', 'Label match'],
    alternatives: [],
  };

  const decision = checkAutofillSafety(field, mapping, profile);
  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.status, 'filled');

  const result = autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'filled');
  assert.strictEqual(field.element.value, 'alex.morgan@example.com');
});

runTest('TEST 2: MEDIUM-confidence field -> skipped', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'loc',
    type: 'text',
  });
  const mapping = {
    profileField: 'personal.location',
    confidence: 0.72,
    confidenceLevel: 'medium',
    reasons: ['Weak token match'],
    alternatives: [],
  };

  const decision = checkAutofillSafety(field, mapping, profile);
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.status, 'skipped');
  assert.strictEqual(decision.reason, 'medium confidence');

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(field.element.value, '');
});

runTest('TEST 3: LOW-confidence field -> skipped', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'misc',
    type: 'text',
  });
  const mapping = {
    profileField: 'education.degree',
    confidence: 0.40,
    confidenceLevel: 'low',
    reasons: ['Vague match'],
    alternatives: [],
  };

  const decision = checkAutofillSafety(field, mapping, profile);
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.status, 'skipped');
  assert.strictEqual(decision.reason, 'low confidence');

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(field.element.value, '');
});

runTest('TEST 4: Ambiguous mapping -> skipped', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'name',
    labelText: 'Name',
    type: 'text',
  });
  const mapping = {
    profileField: 'personal.fullName',
    confidence: 0.58,
    confidenceLevel: 'low',
    reasons: ['Ambiguous: generic identifier could refer to multiple profile fields'],
    alternatives: [
      { profileField: 'personal.firstName', confidence: 0.55, confidenceLevel: 'low', reasons: [] },
      { profileField: 'personal.lastName', confidence: 0.55, confidenceLevel: 'low', reasons: [] },
    ],
  };

  const decision = checkAutofillSafety(field, mapping, profile);
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.status, 'skipped');
  assert.strictEqual(decision.reason, 'ambiguous mapping');

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(field.element.value, '');
});

runTest('TEST 5: Disabled field -> skipped', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'candidate_full_name',
    labelText: 'Full Name',
    disabled: '',
  });
  field.element.disabled = true;

  const mapping = {
    profileField: 'personal.fullName',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['High confidence match'],
    alternatives: [],
  };

  const decision = checkAutofillSafety(field, mapping, profile);
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.status, 'skipped');
  assert.strictEqual(decision.reason, 'disabled field');

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(field.element.value, '');
});

runTest('TEST 6: Readonly field -> skipped', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'candidate_full_name',
    labelText: 'Full Name',
    readonly: '',
  });
  field.element.readOnly = true;

  const mapping = {
    profileField: 'personal.fullName',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['High confidence match'],
    alternatives: [],
  };

  const decision = checkAutofillSafety(field, mapping, profile);
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.status, 'skipped');
  assert.strictEqual(decision.reason, 'readonly field');

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(field.element.value, '');
});

runTest('TEST 7: Password field -> skipped', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'password',
    type: 'password',
    labelText: 'Account Password',
  });

  const mapping = {
    profileField: 'personal.fullName',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: [],
    alternatives: [],
  };

  const decision = checkAutofillSafety(field, mapping, profile);
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.status, 'skipped');
  assert.strictEqual(decision.reason, 'password field');

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(field.element.value, '');
});

runTest('TEST 8: Hidden field -> skipped', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'csrf',
    type: 'hidden',
  });

  const mapping = {
    profileField: 'personal.fullName',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: [],
    alternatives: [],
  };

  const decision = checkAutofillSafety(field, mapping, profile);
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.status, 'skipped');
  assert.strictEqual(decision.reason, 'hidden field');

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(field.element.value, '');
});

runTest('TEST 9: Existing user value -> skipped', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'candidate_name',
    labelText: 'Full Name',
    type: 'text',
  });
  field.element.value = 'User Pre-filled Name';

  const mapping = {
    profileField: 'personal.fullName',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['Direct name match'],
    alternatives: [],
  };

  const decision = checkAutofillSafety(field, mapping, profile);
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.status, 'skipped');
  assert.strictEqual(decision.reason, 'existing user value');

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(field.element.value, 'User Pre-filled Name');
});

runTest('TEST 10: Missing profile value -> skipped', () => {
  const profile = createTestProfile();
  profile.education.cgpa = ''; // empty in profile

  const field = createDetectedField('input', {
    name: 'cgpa',
    labelText: 'Cumulative GPA',
    type: 'number',
  });

  const mapping = {
    profileField: 'education.cgpa',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['Exact CGPA match'],
    alternatives: [],
  };

  const decision = checkAutofillSafety(field, mapping, profile);
  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.status, 'skipped');
  assert.strictEqual(decision.reason, 'missing profile value');

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(field.element.value, '');
});

// ============================================================================
// INPUT TYPES TESTS (11 - 17)
// ============================================================================

runTest('TEST 11: Text input -> fills', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'college_name',
    labelText: 'University / College',
    type: 'text',
  });
  const mapping = {
    profileField: 'education.college',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['College label match'],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'filled');
  assert.strictEqual(field.element.value, 'Stanford University');
});

runTest('TEST 12: Email input -> fills', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'email',
    type: 'email',
    labelText: 'Email Address',
  });
  const mapping = {
    profileField: 'personal.email',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['Email match'],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'filled');
  assert.strictEqual(field.element.value, 'alex.morgan@example.com');
});

runTest('TEST 13: Tel input -> fills', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'phone',
    type: 'tel',
    labelText: 'Mobile Phone Number',
  });
  const mapping = {
    profileField: 'personal.phone',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['Phone match'],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'filled');
  assert.strictEqual(field.element.value, '+1 555-0199');
});

runTest('TEST 14: URL input -> fills', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'github_profile',
    type: 'url',
    labelText: 'GitHub Profile',
  });
  const mapping = {
    profileField: 'online.github',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['GitHub match'],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'filled');
  assert.strictEqual(field.element.value, 'https://github.com/alexmorgan');
});

runTest('TEST 15: Textarea -> fills', () => {
  const profile = createTestProfile();
  const field = createDetectedField('textarea', {
    name: 'technical_skills',
    labelText: 'Key Technical Skills',
  });
  const mapping = {
    profileField: 'skills',
    confidence: 0.92,
    confidenceLevel: 'high',
    reasons: ['Skills label match'],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'filled');
  assert.strictEqual(field.element.value, 'TypeScript, React, Node.js, Python');
});

runTest('TEST 16: Number input -> fills where appropriate', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'grad_year',
    type: 'number',
    labelText: 'Graduation Year',
  });
  const mapping = {
    profileField: 'education.graduationYear',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['Graduation year match'],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'filled');
  assert.strictEqual(field.element.value, '2024');
});

runTest('TEST 17: Unsupported input type -> skipped', () => {
  const profile = createTestProfile();
  const unsupportedTypes = ['submit', 'reset', 'button', 'file', 'image', 'checkbox', 'radio'];

  for (const uType of unsupportedTypes) {
    const field = createDetectedField('input', {
      name: 'resume_file',
      type: uType,
      labelText: 'Resume / Portfolio Upload',
    });
    const mapping = {
      profileField: 'online.portfolio',
      confidence: 0.95,
      confidenceLevel: 'high',
      reasons: [],
      alternatives: [],
    };

    const decision = checkAutofillSafety(field, mapping, profile);
    assert.strictEqual(decision.allowed, false);
    assert.strictEqual(decision.status, 'skipped');
    assert.strictEqual(decision.reason, 'unsupported input type');
  }
});

// ============================================================================
// SELECT TESTS (18 - 20)
// ============================================================================

runTest('TEST 18: Select matches option text', () => {
  const profile = createTestProfile();
  const field = createDetectedField('select', {
    name: 'degree',
    labelText: 'Degree Level',
  });

  const selectEl = field.element;
  selectEl.options = [
    { value: '', text: 'Select degree...' },
    { value: 'bs', text: "Bachelor's Degree" },
    { value: 'ms', text: "Master's Degree" },
    { value: 'phd', text: 'Doctorate / Ph.D.' },
  ];
  selectEl.selectedIndex = 0;

  const mapping = {
    profileField: 'education.degree',
    confidence: 0.92,
    confidenceLevel: 'high',
    reasons: ['Degree match'],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'filled');
  assert.strictEqual(selectEl.selectedIndex, 1);
  assert.strictEqual(selectEl.value, 'bs');
});

runTest('TEST 19: Select matches option value', () => {
  const profile = createTestProfile();
  profile.education.degree = 'bachelors';

  const field = createDetectedField('select', {
    name: 'degree',
    labelText: 'Degree',
  });

  const selectEl = field.element;
  selectEl.options = [
    { value: '', text: 'Choose...' },
    { value: 'bachelors', text: 'B.S. / B.A.' },
    { value: 'masters', text: 'M.S. / M.A.' },
  ];
  selectEl.selectedIndex = 0;

  const mapping = {
    profileField: 'education.degree',
    confidence: 0.92,
    confidenceLevel: 'high',
    reasons: ['Degree match'],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'filled');
  assert.strictEqual(selectEl.selectedIndex, 1);
  assert.strictEqual(selectEl.value, 'bachelors');
});

runTest('TEST 20: Select with no safe match -> skipped', () => {
  const profile = createTestProfile();
  profile.education.degree = 'Doctor of Philosophy';

  const field = createDetectedField('select', {
    name: 'degree',
    labelText: 'Degree',
  });

  const selectEl = field.element;
  selectEl.options = [
    { value: '', text: 'Choose...' },
    { value: 'high_school', text: 'High School' },
    { value: 'bachelors', text: "Bachelor's" },
  ];
  selectEl.selectedIndex = 0;

  const mapping = {
    profileField: 'education.degree',
    confidence: 0.90,
    confidenceLevel: 'high',
    reasons: ['Degree match'],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(selectEl.selectedIndex, 0);
});

// ============================================================================
// EVENTS TESTS (21 - 24)
// ============================================================================

runTest('TEST 21: Input event dispatched with bubbling', () => {
  const element = new MockElement('input', { type: 'text' });
  let inputFired = false;
  let bubbles = false;

  element.addEventListener('input', (e) => {
    inputFired = true;
    bubbles = e.bubbles;
  });

  const success = writeInputValue(element, 'Test Value');
  assert.strictEqual(success, true);
  assert.strictEqual(inputFired, true);
  assert.strictEqual(bubbles, true);
});

runTest('TEST 22: Change event dispatched with bubbling', () => {
  const element = new MockElement('input', { type: 'text' });
  let changeFired = false;
  let bubbles = false;

  element.addEventListener('change', (e) => {
    changeFired = true;
    bubbles = e.bubbles;
  });

  const success = writeInputValue(element, 'Test Value');
  assert.strictEqual(success, true);
  assert.strictEqual(changeFired, true);
  assert.strictEqual(bubbles, true);
});

runTest('TEST 23: Form is NOT submitted', () => {
  const form = new MockElement('form');
  const input = new MockElement('input', { type: 'text', name: 'fullname' });
  form.children.push(input);
  input.parentElement = form;

  let formSubmitted = false;
  form.addEventListener('submit', () => {
    formSubmitted = true;
  });

  const profile = createTestProfile();
  const field = {
    element: input,
    metadata: {
      tagName: 'input',
      type: 'text',
      name: 'fullname',
      nameNormalized: 'fullname',
      id: '',
      idNormalized: '',
      placeholder: '',
      placeholderNormalized: '',
      ariaLabel: '',
      ariaLabelNormalized: '',
      ariaLabelledBy: '',
      autocomplete: '',
      autocompleteNormalized: '',
      labelText: 'Full Name',
      labelTextNormalized: 'full name',
      surroundingText: '',
      surroundingTextNormalized: '',
    },
  };
  const mapping = {
    profileField: 'personal.fullName',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: [],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  engine.autofillField(field, mapping, profile);

  assert.strictEqual(input.value, 'Alex Morgan');
  assert.strictEqual(formSubmitted, false, 'Form must NEVER be submitted during autofill');
});

runTest('TEST 24: No button is clicked', () => {
  const form = new MockElement('form');
  const button = new MockElement('button', { type: 'submit' });
  form.children.push(button);
  button.parentElement = form;

  let buttonClicked = false;
  button.addEventListener('click', () => {
    buttonClicked = true;
  });

  const input = new MockElement('input', { type: 'email', name: 'email' });
  form.children.push(input);
  input.parentElement = form;

  const profile = createTestProfile();
  const field = {
    element: input,
    metadata: {
      tagName: 'input',
      type: 'email',
      name: 'email',
      nameNormalized: 'email',
      id: '',
      idNormalized: '',
      placeholder: '',
      placeholderNormalized: '',
      ariaLabel: '',
      ariaLabelNormalized: '',
      ariaLabelledBy: '',
      autocomplete: 'email',
      autocompleteNormalized: 'email',
      labelText: 'Email',
      labelTextNormalized: 'email',
      surroundingText: '',
      surroundingTextNormalized: '',
    },
  };
  const mapping = {
    profileField: 'personal.email',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: [],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  engine.autofillField(field, mapping, profile);

  assert.strictEqual(input.value, 'alex.morgan@example.com');
  assert.strictEqual(buttonClicked, false, 'Buttons must NEVER be clicked during autofill');
});

// ============================================================================
// PROFILE MAPPING TESTS (25 - 30)
// ============================================================================

runTest('TEST 25: personal.fullName resolves correctly', () => {
  const profile = createTestProfile();
  const val = getProfileValue(profile, 'personal.fullName');
  assert.strictEqual(val, 'Alex Morgan');
});

runTest('TEST 26: personal.email resolves correctly', () => {
  const profile = createTestProfile();
  const val = getProfileValue(profile, 'personal.email');
  assert.strictEqual(val, 'alex.morgan@example.com');
});

runTest('TEST 27: personal.phone resolves correctly', () => {
  const profile = createTestProfile();
  const val = getProfileValue(profile, 'personal.phone');
  assert.strictEqual(val, '+1 555-0199');
});

runTest('TEST 28: education.college resolves correctly', () => {
  const profile = createTestProfile();
  const val = getProfileValue(profile, 'education.college');
  assert.strictEqual(val, 'Stanford University');
});

runTest('TEST 29: online.github resolves correctly', () => {
  const profile = createTestProfile();
  const val = getProfileValue(profile, 'online.github');
  assert.strictEqual(val, 'https://github.com/alexmorgan');
});

runTest('TEST 30: skills resolves correctly into joined string', () => {
  const profile = createTestProfile();
  const val = getProfileValue(profile, 'skills');
  assert.strictEqual(val, 'TypeScript, React, Node.js, Python');

  // Empty skills array
  const emptyProfile = createTestProfile();
  emptyProfile.skills = [];
  assert.strictEqual(getProfileValue(emptyProfile, 'skills'), null);
});

// ============================================================================
// SAFETY / REGRESSION TESTS (31 - 36)
// ============================================================================

runTest('TEST 31: Profile values are never written to console logs', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'candidate_email',
    labelText: 'Email Address',
    type: 'email',
  });
  const mapping = {
    profileField: 'personal.email',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: ['Email match'],
    alternatives: [],
  };

  const capturedLogs = [];
  const origLog = console.log;
  console.log = (...args) => {
    capturedLogs.push(args.join(' '));
  };

  try {
    const engine = new AutofillEngine();
    const result = engine.autofillField(field, mapping, profile);

    // Simulated content script logging pattern
    if (result.status === 'filled') {
      console.log(`[FILLO] Autofilled: ${result.profileField} (high confidence)`);
    } else {
      console.log(`[FILLO] Skipped field: ${result.reason}`);
    }

    const logOutput = capturedLogs.join('\n');
    assert.strictEqual(logOutput.includes('alex.morgan@example.com'), false);
    assert.strictEqual(logOutput.includes('Alex Morgan'), false);
    assert.strictEqual(logOutput.includes('+1 555-0199'), false);
    assert.strictEqual(logOutput.includes('Stanford University'), false);
    assert.strictEqual(logOutput.includes('[FILLO] Autofilled: personal.email (high confidence)'), true);
  } finally {
    console.log = origLog;
  }
});

runTest('TEST 32: Autofill does not overwrite existing values', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'candidate_email',
    labelText: 'Email Address',
    type: 'email',
  });
  field.element.value = 'prefilled@domain.com';

  const mapping = {
    profileField: 'personal.email',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: [],
    alternatives: [],
  };

  const engine = new AutofillEngine();
  const result = engine.autofillField(field, mapping, profile);
  assert.strictEqual(result.status, 'skipped');
  assert.strictEqual(result.reason, 'existing user value');
  assert.strictEqual(field.element.value, 'prefilled@domain.com');
});

runTest('TEST 33: Same field is not repeatedly autofilled (WeakSet tracking)', () => {
  const profile = createTestProfile();
  const field = createDetectedField('input', {
    name: 'candidate_email',
    labelText: 'Email Address',
    type: 'email',
  });
  const mapping = {
    profileField: 'personal.email',
    confidence: 0.95,
    confidenceLevel: 'high',
    reasons: [],
    alternatives: [],
  };

  const engine = new AutofillEngine();

  // First attempt: should fill
  const firstResult = engine.autofillField(field, mapping, profile);
  assert.strictEqual(firstResult.status, 'filled');
  assert.strictEqual(field.element.value, 'alex.morgan@example.com');

  // Second attempt on same element: should skip via WeakSet deduplication
  const secondResult = engine.autofillField(field, mapping, profile);
  assert.strictEqual(secondResult.status, 'skipped');
  assert.strictEqual(secondResult.reason, 'already autofilled');
});

runTest('TEST 34: M2 profile validation logic still passes with 0 regressions', () => {
  const validProfile = createTestProfile();
  const valResult = validateProfile(validProfile);
  assert.strictEqual(valResult.isValid, true);
  assert.strictEqual(Object.keys(valResult.errors).length, 0);

  const skills = normalizeSkills('TypeScript, Python, React, TypeScript');
  assert.deepStrictEqual(skills, ['TypeScript', 'Python', 'React']);
});

runTest('TEST 35: M3A field text normalization logic still passes with 0 regressions', () => {
  assert.strictEqual(normalizeFieldText('candidate_full_name'), 'candidate full name');
  assert.strictEqual(normalizeFieldText('applicantFirstName'), 'applicant first name');
  assert.strictEqual(normalizeFieldText('PHONE-NUMBER'), 'phone number');
});

runTest('TEST 36: M3B field mapping engine still passes with 0 regressions', () => {
  const mapped = mapField({
    tagName: 'input',
    type: 'text',
    name: 'candidate_full_name',
    nameNormalized: 'candidate full name',
    id: '',
    idNormalized: '',
    placeholder: '',
    placeholderNormalized: '',
    ariaLabel: '',
    ariaLabelNormalized: '',
    ariaLabelledBy: '',
    autocomplete: 'name',
    autocompleteNormalized: 'name',
    labelText: 'Full Name',
    labelTextNormalized: 'full name',
    surroundingText: '',
    surroundingTextNormalized: '',
  });

  assert.strictEqual(mapped.profileField, 'personal.fullName');
  assert.strictEqual(mapped.confidenceLevel, 'high');
  assert.strictEqual(mapped.confidence >= 0.85, true);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('----------------------------------------------------');
console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
console.log('----------------------------------------------------');

if (failedTests > 0) {
  console.error(`💥 ${failedTests} test(s) failed.`);
  process.exit(1);
} else {
  console.log(`🎉 ALL ${passedTests} AUTOFILL BEHAVIORAL TESTS PASSED!`);
}
