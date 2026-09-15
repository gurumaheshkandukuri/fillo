/**
 * FILLO Milestone 5: Real-World Form Compatibility & Autofill UX Behavioral Tests
 * Comprehensive behavioral test suite verifying realistic semantic forms, dynamic insertions,
 * user-triggered control, popup/controller state, safety refusal, privacy preservation, and regressions.
 */

import assert from 'assert';
import { AutofillController } from '../src/autofill/autofill-controller.ts';
import { AutofillEngine } from '../src/autofill/autofill-engine.ts';
import { FieldDetector } from '../src/content/field-detector.ts';
import { mapField } from '../src/mapping/mapper.ts';
import { checkAutofillSafety } from '../src/autofill/safety-gate.ts';
import { getProfileValue } from '../src/autofill/profile-value.ts';
import { normalizeFieldText } from '../src/utils/normalize-field.ts';
import { validateProfile } from '../src/utils/validation.ts';
import { normalizeSkills } from '../src/utils/normalize.ts';
import { createEmptyProfile } from '../src/types/profile.ts';

console.log('----------------------------------------------------');
console.log('🧪 Running FILLO Milestone 5 Behavioral Tests...');
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
 * Lightweight mock DOM Element for behavioral testing.
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
    return (
      this.attrs.get('type') ||
      (this.tagName === 'TEXTAREA'
        ? 'textarea'
        : this.tagName === 'SELECT'
        ? 'select-one'
        : 'text')
    );
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
}

/**
 * Standard test profile for candidate data.
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
// REALISTIC SEMANTIC FIELDS (1 - 8)
// ============================================================================

runTest('TEST 1: Job application form candidate fields map accurately', () => {
  const field1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });
  const field2 = createDetectedField('input', { name: 'email_address', type: 'email', labelText: 'Email Address' });
  const field3 = createDetectedField('input', { name: 'mobile_phone', type: 'tel', labelText: 'Mobile Number' });

  assert.strictEqual(mapField(field1.metadata).profileField, 'personal.fullName');
  assert.strictEqual(mapField(field2.metadata).profileField, 'personal.email');
  assert.strictEqual(mapField(field3.metadata).profileField, 'personal.phone');
});

runTest('TEST 2: Scholarship form alternate wording maps accurately', () => {
  const f1 = createDetectedField('input', { name: 'applicant_full_name', labelText: "Applicant's Full Name" });
  const f2 = createDetectedField('input', { name: 'institution', labelText: 'Institution' });
  const f3 = createDetectedField('input', { name: 'program_of_study', labelText: 'Program of Study' });
  const f4 = createDetectedField('input', { name: 'field_of_study', labelText: 'Field of Study' });

  assert.strictEqual(mapField(f1.metadata).profileField, 'personal.fullName');
  assert.strictEqual(mapField(f2.metadata).profileField, 'education.college');
  assert.strictEqual(mapField(f3.metadata).profileField, 'education.degree');
  assert.strictEqual(mapField(f4.metadata).profileField, 'education.branch');
});

runTest('TEST 3: Internship form fields map accurately', () => {
  const f1 = createDetectedField('input', { name: 'candidate_name', labelText: 'Candidate Name' });
  const f2 = createDetectedField('input', { name: 'major', labelText: 'Major' });
  const f3 = createDetectedField('input', { name: 'website', type: 'url', labelText: 'Personal Website' });

  assert.strictEqual(mapField(f1.metadata).profileField, 'personal.fullName');
  assert.strictEqual(mapField(f2.metadata).profileField, 'education.branch');
  assert.strictEqual(mapField(f3.metadata).profileField, 'online.portfolio');
});

runTest('TEST 4: Alternative wording (Completion Year, Contact Email) maps accurately', () => {
  const f1 = createDetectedField('input', { name: 'completion_year', labelText: 'Expected Completion Year', type: 'number' });
  const f2 = createDetectedField('input', { name: 'contact_email', labelText: 'Contact Email', type: 'email' });

  assert.strictEqual(mapField(f1.metadata).profileField, 'education.graduationYear');
  assert.strictEqual(mapField(f2.metadata).profileField, 'personal.email');
});

runTest('TEST 5: Negative company context (Company Name, Previous Company, Company Website) refused', () => {
  const f1 = createDetectedField('input', { name: 'company_name', labelText: 'Company Name' });
  const f2 = createDetectedField('input', { name: 'previous_company', labelText: 'Previous Company' });
  const f3 = createDetectedField('input', { name: 'company_website', labelText: 'Company Website' });

  assert.notStrictEqual(mapField(f1.metadata).profileField, 'personal.fullName');
  assert.notStrictEqual(mapField(f2.metadata).profileField, 'education.college');
  assert.notStrictEqual(mapField(f3.metadata).profileField, 'online.portfolio');
});

runTest('TEST 6: Emergency contact context refused', () => {
  const f1 = createDetectedField('input', { name: 'emergency_contact_name', labelText: 'Emergency Contact Name' });
  const f2 = createDetectedField('input', { name: 'emergency_contact_phone', labelText: 'Emergency Contact Number' });

  assert.notStrictEqual(mapField(f1.metadata).profileField, 'personal.fullName');
  assert.notStrictEqual(mapField(f2.metadata).profileField, 'personal.phone');
});

runTest('TEST 7: Recruiter context refused', () => {
  const f1 = createDetectedField('input', { name: 'recruiter_name', labelText: 'Recruiter Name' });
  const f2 = createDetectedField('input', { name: 'recruiter_phone', labelText: 'Recruiter Phone' });

  assert.notStrictEqual(mapField(f1.metadata).profileField, 'personal.fullName');
  assert.notStrictEqual(mapField(f2.metadata).profileField, 'personal.phone');
});

runTest('TEST 8: Username context refused', () => {
  const f1 = createDetectedField('input', { name: 'username', labelText: 'Username' });
  assert.notStrictEqual(mapField(f1.metadata).profileField, 'personal.fullName');
});

// ============================================================================
// DYNAMIC FORMS (9 - 12)
// ============================================================================

runTest('TEST 9: Initial fields detected', () => {
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });
  const f2 = createDetectedField('input', { name: 'email', labelText: 'Email', type: 'email' });

  const controller = new AutofillController();
  const status = controller.getStatus(createTestProfile(), [f1, f2]);

  assert.strictEqual(status.detectedCount, 2);
  assert.strictEqual(status.eligibleCount, 2);
});

runTest('TEST 10: Dynamically inserted fields detected', () => {
  const initialFields = [
    createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' }),
  ];

  const controller = new AutofillController();
  const initialStatus = controller.getStatus(createTestProfile(), initialFields);
  assert.strictEqual(initialStatus.detectedCount, 1);

  // Dynamically added education fields
  const dynamicFields = [
    ...initialFields,
    createDetectedField('input', { name: 'college_name', labelText: 'College' }),
    createDetectedField('input', { name: 'grad_year', labelText: 'Graduation Year', type: 'number' }),
  ];

  const updatedStatus = controller.getStatus(createTestProfile(), dynamicFields);
  assert.strictEqual(updatedStatus.detectedCount, 3);
  assert.strictEqual(updatedStatus.eligibleCount, 3);
});

runTest('TEST 11: Dynamically inserted fields mapped accurately', () => {
  const dynamicField = createDetectedField('input', { name: 'college_name', labelText: 'College' });
  const mapping = mapField(dynamicField.metadata);
  assert.strictEqual(mapping.profileField, 'education.college');
  assert.strictEqual(mapping.confidenceLevel, 'high');
});

runTest('TEST 12: Dynamic fields do not cause duplicate autofill loops', () => {
  const profile = createTestProfile();
  const engine = new AutofillEngine();
  const controller = new AutofillController(undefined, engine);

  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });

  // First fill: 1 field filled
  const res1 = controller.executeAutofill(profile, [f1]);
  assert.strictEqual(res1.filled, 1);
  assert.strictEqual(f1.element.value, 'Alex Morgan');

  // Dynamic field arrives
  const f2 = createDetectedField('input', { name: 'candidate_email', labelText: 'Email', type: 'email' });
  const res2 = controller.executeAutofill(profile, [f1, f2]);

  // f1 is already filled; only f2 should be filled
  assert.strictEqual(res2.filled, 1);
  assert.strictEqual(f2.element.value, 'alex.morgan@example.com');
  assert.strictEqual(f1.element.value, 'Alex Morgan');
});

// ============================================================================
// USER CONTROL (13 - 16)
// ============================================================================

runTest('TEST 13: No autofill before user action', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });

  const controller = new AutofillController();
  // Status check inspects DOM state but must NOT write values
  const status = controller.getStatus(profile, [f1]);

  assert.strictEqual(status.eligibleCount, 1);
  assert.strictEqual(f1.element.value, '', 'Element value must remain empty until user explicitly triggers fill');
});

runTest('TEST 14: Fill action triggers autofill', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });

  const controller = new AutofillController();
  const summary = controller.executeAutofill(profile, [f1]);

  assert.strictEqual(summary.filled, 1);
  assert.strictEqual(f1.element.value, 'Alex Morgan');
});

runTest('TEST 15: Second Fill action does not refill same field', () => {
  const profile = createTestProfile();
  const engine = new AutofillEngine();
  const controller = new AutofillController(undefined, engine);
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });

  // Click 1: Fill
  const res1 = controller.executeAutofill(profile, [f1]);
  assert.strictEqual(res1.filled, 1);

  // Click 2: Fill again
  const res2 = controller.executeAutofill(profile, [f1]);
  assert.strictEqual(res2.filled, 0, 'Second fill must not refill already-filled fields');
  assert.strictEqual(res2.skipped, 1);
  assert.strictEqual(res2.skippedReasons[0].reason, 'already autofilled');
});

runTest('TEST 16: Existing user values remain untouched', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });
  f1.element.value = 'Pre-existing User Name';

  const controller = new AutofillController();
  const res = controller.executeAutofill(profile, [f1]);

  assert.strictEqual(res.filled, 0);
  assert.strictEqual(f1.element.value, 'Pre-existing User Name');
});

// ============================================================================
// POPUP / CONTROLLER (17 - 20)
// ============================================================================

runTest('TEST 17: No profile -> fill disabled', () => {
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });
  const controller = new AutofillController();

  const status = controller.getStatus(null, [f1]);
  assert.strictEqual(status.profileReady, false);
  assert.strictEqual(status.ready, false);
  assert.strictEqual(status.eligibleCount, 0);
});

runTest('TEST 18: No eligible fields -> fill disabled', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'company_name', labelText: 'Company Name' });
  const controller = new AutofillController();

  const status = controller.getStatus(profile, [f1]);
  assert.strictEqual(status.profileReady, true);
  assert.strictEqual(status.ready, false);
  assert.strictEqual(status.eligibleCount, 0);
});

runTest('TEST 19: Eligible fields -> fill enabled', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });
  const controller = new AutofillController();

  const status = controller.getStatus(profile, [f1]);
  assert.strictEqual(status.profileReady, true);
  assert.strictEqual(status.ready, true);
  assert.strictEqual(status.eligibleCount, 1);
});

runTest('TEST 20: Result summary returned', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });
  const f2 = createDetectedField('input', { name: 'company_name', labelText: 'Company Name' });

  const controller = new AutofillController();
  const summary = controller.executeAutofill(profile, [f1, f2]);

  assert.strictEqual(summary.detected, 2);
  assert.strictEqual(summary.eligible, 1);
  assert.strictEqual(summary.filled, 1);
  assert.strictEqual(summary.skipped, 1);
  assert.strictEqual(Array.isArray(summary.skippedReasons), true);
  assert.strictEqual(summary.skippedReasons.length, 1);
});

// ============================================================================
// SAFETY (21 - 27)
// ============================================================================

runTest('TEST 21: Ambiguous fields remain skipped', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'name', labelText: 'Name' });
  const controller = new AutofillController();

  const res = controller.executeAutofill(profile, [f1]);
  assert.strictEqual(res.filled, 0);
  assert.strictEqual(res.skipped, 1);
});

runTest('TEST 22: Medium confidence remains skipped', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'loc', labelText: 'Loc' });
  const controller = new AutofillController();

  const res = controller.executeAutofill(profile, [f1]);
  assert.strictEqual(res.filled, 0);
  assert.strictEqual(res.skipped, 1);
});

runTest('TEST 23: Low confidence remains skipped', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'random_id', labelText: 'Miscellaneous Code' });
  const controller = new AutofillController();

  const res = controller.executeAutofill(profile, [f1]);
  assert.strictEqual(res.filled, 0);
  assert.strictEqual(res.skipped, 1);
});

runTest('TEST 24: Password remains skipped', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'password', type: 'password', labelText: 'Password' });
  const controller = new AutofillController();

  const res = controller.executeAutofill(profile, [f1]);
  assert.strictEqual(res.filled, 0);
  assert.strictEqual(res.skipped, 1);
});

runTest('TEST 25: Disabled remains skipped', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name', disabled: '' });
  f1.element.disabled = true;

  const controller = new AutofillController();
  const res = controller.executeAutofill(profile, [f1]);
  assert.strictEqual(res.filled, 0);
  assert.strictEqual(res.skipped, 1);
});

runTest('TEST 26: Readonly remains skipped', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name', readonly: '' });
  f1.element.readOnly = true;

  const controller = new AutofillController();
  const res = controller.executeAutofill(profile, [f1]);
  assert.strictEqual(res.filled, 0);
  assert.strictEqual(res.skipped, 1);
});

runTest('TEST 27: Unsupported inputs remain skipped', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'resume_upload', type: 'file', labelText: 'Upload Resume' });
  const controller = new AutofillController();

  const res = controller.executeAutofill(profile, [f1]);
  assert.strictEqual(res.filled, 0);
  assert.strictEqual(res.skipped, 1);
});

// ============================================================================
// PRIVACY (28 - 30)
// ============================================================================

runTest('TEST 28: No profile values in console logs', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_email', type: 'email', labelText: 'Email Address' });

  const captured = [];
  const orig = console.log;
  console.log = (...args) => captured.push(args.join(' '));

  try {
    const controller = new AutofillController();
    controller.executeAutofill(profile, [f1]);

    const allLogs = captured.join('\n');
    assert.strictEqual(allLogs.includes('alex.morgan@example.com'), false);
    assert.strictEqual(allLogs.includes('Alex Morgan'), false);
    assert.strictEqual(allLogs.includes('[FILLO] Autofilled: personal.email (high confidence)'), true);
  } finally {
    console.log = orig;
  }
});

runTest('TEST 29: No profile values in popup messages or status summaries', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });
  const controller = new AutofillController();

  const status = controller.getStatus(profile, [f1]);
  const serializedStatus = JSON.stringify(status);

  assert.strictEqual(serializedStatus.includes('Alex Morgan'), false);
  assert.strictEqual(serializedStatus.includes('alex.morgan@example.com'), false);
  assert.strictEqual(serializedStatus.includes('+1 555-0199'), false);
});

runTest('TEST 30: No unnecessary profile data transferred in execution summary', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });
  const controller = new AutofillController();

  const summary = controller.executeAutofill(profile, [f1]);
  const serializedSummary = JSON.stringify(summary);

  assert.strictEqual(serializedSummary.includes('Alex Morgan'), false);
  assert.strictEqual(serializedSummary.includes('alex.morgan@example.com'), false);
  assert.strictEqual(serializedSummary.includes('Stanford University'), false);
});

// ============================================================================
// REGRESSION (31 - 34)
// ============================================================================

runTest('TEST 31: M2 profile validation logic still passes with 0 regressions', () => {
  const valid = createTestProfile();
  assert.strictEqual(validateProfile(valid).isValid, true);

  const skills = normalizeSkills('React, Python, TypeScript');
  assert.deepStrictEqual(skills, ['React', 'Python', 'TypeScript']);
});

runTest('TEST 32: M3A field detector text normalization still passes with 0 regressions', () => {
  assert.strictEqual(normalizeFieldText('candidate_full_name'), 'candidate full name');
  assert.strictEqual(normalizeFieldText('applicantFirstName'), 'applicant first name');
});

runTest('TEST 33: M3B field mapping engine still passes with 0 regressions', () => {
  const res = mapField({
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

  assert.strictEqual(res.profileField, 'personal.fullName');
  assert.strictEqual(res.confidenceLevel, 'high');
});

runTest('TEST 34: M4 safe autofill engine still passes with 0 regressions', () => {
  const profile = createTestProfile();
  const f1 = createDetectedField('input', { name: 'candidate_full_name', labelText: 'Full Name' });
  const mapping = mapField(f1.metadata);

  const safety = checkAutofillSafety(f1, mapping, profile);
  assert.strictEqual(safety.allowed, true);

  const engine = new AutofillEngine();
  const fillRes = engine.autofillField(f1, mapping, profile);
  assert.strictEqual(fillRes.status, 'filled');
  assert.strictEqual(f1.element.value, 'Alex Morgan');
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
  console.log(`🎉 ALL ${passedTests} M5 BEHAVIORAL TESTS PASSED!`);
}
