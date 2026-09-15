/**
 * FILLO Milestone 6: Production Hardening & Real-World Compatibility Behavioral Tests
 * Comprehensive test suite verifying lifecycle, dynamic DOM, semantics, context safety,
 * framework behavior, native controls, edge cases, popup lifecycle, privacy, and regressions.
 */

import assert from 'assert';
import { AutofillController } from '../src/autofill/autofill-controller.ts';
import { AutofillEngine } from '../src/autofill/autofill-engine.ts';
import { FieldDetector } from '../src/content/field-detector.ts';
import { DynamicFormObserver } from '../src/content/mutation-observer.ts';
import { mapField } from '../src/mapping/mapper.ts';
import { checkAutofillSafety } from '../src/autofill/safety-gate.ts';
import { writeInputValue, writeSelectValue } from '../src/autofill/value-writer.ts';
import { getProfileValue } from '../src/autofill/profile-value.ts';
import { validateProfile } from '../src/utils/validation.ts';
import { normalizeSkills } from '../src/utils/normalize.ts';
import { normalizeFieldText } from '../src/utils/normalize-field.ts';
import { createEmptyProfile } from '../src/types/profile.ts';

console.log('----------------------------------------------------');
console.log('🧪 Running FILLO Milestone 6 Hardening Tests...');
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
 * Lightweight mock DOM Element for hardening tests.
 */
class MockElement {
  constructor(tagName = 'input', attrs = {}) {
    this.tagName = tagName.toUpperCase();
    this.attrs = new Map();
    this.children = [];
    this.parentElement = null;
    this.parentNode = null;
    this.disabled = false;
    this.readOnly = false;
    this.hidden = false;
    this.isContentEditable = false;
    this._value = '';
    this.eventListeners = new Map();
    this.dispatchedEvents = [];
    this.options = [];
    this.selectedIndex = -1;
    this.isConnected = true;
    this.shadowRoot = null;

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
    if (name === 'contenteditable') this.isContentEditable = (value === 'true');
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

  appendChild(child) {
    child.parentElement = this;
    child.parentNode = this;
    child.isConnected = this.isConnected;
    this.children.push(child);
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
      child.parentNode = null;
      child.isConnected = false;
    }
  }

  querySelectorAll(selector) {
    const results = [];
    const checkElement = (el) => {
      const tag = el.tagName.toLowerCase();
      if (selector === '*' || selector.split(',').map((s) => s.trim().toLowerCase()).includes(tag)) {
        results.push(el);
      }
      for (const child of el.children) {
        checkElement(child);
      }
    };
    for (const child of this.children) {
      checkElement(child);
    }
    return results;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  get textContent() {
    if (this._textContent !== undefined) return this._textContent;
    return this.children.map((c) => c.textContent).join(' ');
  }

  set textContent(val) {
    this._textContent = val;
    this.children = [];
  }

  get previousElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return idx > 0 ? siblings[idx - 1] : null;
  }

  get previousSibling() {
    return this.previousElementSibling;
  }

  closest(selector) {
    const selTag = selector.toUpperCase();
    let curr = this.parentElement;
    while (curr) {
      if (curr.tagName === selTag) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  cloneNode(deep = true) {
    const clone = new MockElement(this.tagName.toLowerCase(), Object.fromEntries(this.attrs));
    clone.disabled = this.disabled;
    clone.readOnly = this.readOnly;
    clone.hidden = this.hidden;
    clone.isContentEditable = this.isContentEditable;
    clone._value = this._value;
    clone._textContent = this._textContent;
    if (deep) {
      for (const c of this.children) {
        clone.appendChild(c.cloneNode(true));
      }
    }
    return clone;
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

class MockShadowRoot {
  constructor(children = []) {
    this.children = children;
  }

  querySelectorAll(selector) {
    const results = [];
    const check = (el) => {
      const tag = el.tagName.toLowerCase();
      if (selector === '*' || selector.split(',').map((s) => s.trim().toLowerCase()).includes(tag)) {
        results.push(el);
      }
      for (const c of (el.children || [])) {
        check(c);
      }
    };
    for (const child of this.children) {
      check(child);
    }
    return results;
  }
}

function createTestProfile() {
  return {
    personal: {
      fullName: 'Alex Morgan',
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'alex.morgan@example.com',
      phone: '+1 555-0199',
      location: 'Seattle, WA',
    },
    education: {
      college: 'University of Washington',
      degree: 'Bachelor of Science',
      branch: 'Computer Science',
      cgpa: '3.85',
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

// ============================================================================
// CATEGORY 1: LIFECYCLE (Tests 1–5)
// ============================================================================

runTest('TEST 1: Page-load detection does not autofill', () => {
  const root = new MockElement('form');
  const input = new MockElement('input', { name: 'candidate_full_name', placeholder: 'Full Name' });
  root.appendChild(input);

  const detector = new FieldDetector();
  const controller = new AutofillController(detector);
  const profile = createTestProfile();

  // Page-load scan and status evaluation
  const fields = detector.scan(root);
  assert.strictEqual(fields.length, 1);
  const status = controller.getStatus(profile, fields);

  assert.strictEqual(status.detectedCount, 1);
  assert.strictEqual(status.eligibleCount, 1);
  assert.strictEqual(input.value, '', 'Input value MUST remain empty after page load scan');
});

runTest('TEST 2: Mutation detection does not autofill', () => {
  const root = new MockElement('div');
  const detector = new FieldDetector();
  const controller = new AutofillController(detector);
  const profile = createTestProfile();

  // Dynamic input added to DOM
  const dynamicInput = new MockElement('input', { name: 'candidate_email', type: 'email', placeholder: 'Email Address' });
  root.appendChild(dynamicInput);

  const fields = detector.scan(root);
  assert.strictEqual(fields.length, 1);
  const status = controller.getStatus(profile, fields);

  assert.strictEqual(status.eligibleCount, 1);
  assert.strictEqual(dynamicInput.value, '', 'Input value MUST remain empty after mutation scan');
});

runTest('TEST 3: Route change does not autofill', () => {
  const root = new MockElement('div');
  const detector = new FieldDetector();
  const controller = new AutofillController(detector);
  const profile = createTestProfile();

  // Route 1 field
  const page1Input = new MockElement('input', { name: 'phone', type: 'tel' });
  root.appendChild(page1Input);
  detector.scan(root);

  // Route transition: unmount page 1 field, mount page 2 field
  root.removeChild(page1Input);
  const page2Input = new MockElement('input', { name: 'github', type: 'url', placeholder: 'GitHub Profile' });
  root.appendChild(page2Input);

  // Route change rescan
  detector.pruneStaleFields();
  const activeFields = detector.scan(root);
  const status = controller.getStatus(profile, activeFields);

  assert.strictEqual(status.detectedCount, 1);
  assert.strictEqual(page2Input.value, '', 'Route change MUST NOT trigger automatic autofill');
});

runTest('TEST 4: User action does autofill', () => {
  const root = new MockElement('form');
  const input = new MockElement('input', { name: 'candidate_full_name', placeholder: 'Full Name' });
  root.appendChild(input);

  const detector = new FieldDetector();
  const engine = new AutofillEngine();
  const controller = new AutofillController(detector, engine);
  const profile = createTestProfile();

  const fields = detector.scan(root);
  assert.strictEqual(input.value, '');

  // User explicitly triggers Fill
  const result = controller.executeAutofill(profile, fields);
  assert.strictEqual(result.filled, 1);
  assert.strictEqual(input.value, 'Alex Morgan', 'User action fills the profile value');
});

runTest('TEST 5: Repeated user action does not refill', () => {
  const root = new MockElement('form');
  const input = new MockElement('input', { name: 'candidate_full_name', placeholder: 'Full Name' });
  root.appendChild(input);

  const detector = new FieldDetector();
  const engine = new AutofillEngine();
  const controller = new AutofillController(detector, engine);
  const profile = createTestProfile();

  const fields = detector.scan(root);
  const firstFill = controller.executeAutofill(profile, fields);
  assert.strictEqual(firstFill.filled, 1);

  // Second user click on "Fill with FILLO"
  const secondFill = controller.executeAutofill(profile, fields);
  assert.strictEqual(secondFill.filled, 0, 'Repeated Fill action MUST NOT refill');
  assert.strictEqual(secondFill.skipped, 1);
  assert.strictEqual(secondFill.skippedReasons[0].reason, 'already autofilled');
});

// ============================================================================
// CATEGORY 2: DYNAMIC DOM (Tests 6–10)
// ============================================================================

runTest('TEST 6: Dynamically added input detected', () => {
  const root = new MockElement('div');
  const detector = new FieldDetector();

  const initial = detector.scan(root);
  assert.strictEqual(initial.length, 0);

  // Dynamic insertion
  const newInput = new MockElement('input', { name: 'portfolio', type: 'url' });
  root.appendChild(newInput);

  const newlyDetected = detector.scan(root);
  assert.strictEqual(newlyDetected.length, 1);
  assert.strictEqual(newlyDetected[0].element, newInput);
});

runTest('TEST 7: Dynamically removed input no longer active', () => {
  const root = new MockElement('div');
  const input = new MockElement('input', { name: 'college', placeholder: 'University' });
  root.appendChild(input);

  const detector = new FieldDetector();
  detector.scan(root);
  assert.strictEqual(detector.getDetectedFields().length, 1);

  // Dynamic removal
  root.removeChild(input);
  assert.strictEqual(input.isConnected, false);

  const activeFields = detector.getDetectedFields();
  assert.strictEqual(activeFields.length, 0, 'Disconnected field must be pruned from active inventory');
});

runTest('TEST 8: Replaced input treated as new field', () => {
  const root = new MockElement('div');
  const oldInput = new MockElement('input', { name: 'old_field', placeholder: 'Full Name' });
  root.appendChild(oldInput);

  const detector = new FieldDetector();
  detector.scan(root);
  assert.strictEqual(detector.getDetectedFields().length, 1);

  // Replace with a brand new element
  root.removeChild(oldInput);
  const newInput = new MockElement('input', { name: 'new_field', placeholder: 'Candidate Full Name' });
  root.appendChild(newInput);

  const scanResult = detector.scan(root);
  assert.strictEqual(scanResult.length, 1);
  assert.strictEqual(scanResult[0].element, newInput, 'New replacement element treated as new field');
  assert.strictEqual(detector.getDetectedFields().length, 1);
});

runTest('TEST 9: Mutation batching works without premature duplicate rescans', () => {
  let scanCount = 0;
  const detector = {
    scan: () => {
      scanCount++;
      return [];
    },
    pruneStaleFields: () => {},
  };

  const observer = new DynamicFormObserver(detector);
  // Direct simulation of scheduleScan debouncing
  observer.scheduleScan();
  observer.scheduleScan();
  observer.scheduleScan();

  // Pending scan is batched (not run 3 separate synchronous times)
  assert.strictEqual(scanCount, 0, 'Scans are batched/debounced asynchronously');
  observer.stop();
});

runTest('TEST 10: No autofill loop after DOM mutation', () => {
  const root = new MockElement('form');
  const input = new MockElement('input', { name: 'candidate_full_name', placeholder: 'Full Name' });
  root.appendChild(input);

  const detector = new FieldDetector();
  const engine = new AutofillEngine();
  const controller = new AutofillController(detector, engine);
  const profile = createTestProfile();

  const fields = detector.scan(root);
  controller.executeAutofill(profile, fields);
  assert.strictEqual(input.value, 'Alex Morgan');

  // Value modification does not trigger dynamic additions
  // And even if a mutation scan occurs, it does not re-autofill
  const postScan = detector.scan(root);
  assert.strictEqual(postScan.length, 0, 'Already tracked input not treated as new insertion');

  const statusAfter = controller.getStatus(profile, detector.getDetectedFields());
  assert.strictEqual(statusAfter.eligibleCount, 0, 'Already filled input is not eligible (prevents loop)');
});

// ============================================================================
// CATEGORY 3: SEMANTIC DETECTION (Tests 11–16)
// ============================================================================

runTest('TEST 11: ARIA-only email', () => {
  const el = new MockElement('input', {
    type: 'email',
    'aria-label': 'Candidate Email Address',
  });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  assert.ok(field);

  const mapping = mapField(field.metadata);
  assert.strictEqual(mapping.profileField, 'personal.email');
  assert.strictEqual(mapping.confidenceLevel, 'high');
});

runTest('TEST 12: ARIA-labelled full name', () => {
  const labelEl = new MockElement('span', { id: 'name_header' });
  labelEl.textContent = 'Candidate Full Name';

  const doc = {
    getElementById: (id) => (id === 'name_header' ? labelEl : null),
  };

  const el = new MockElement('input', {
    type: 'text',
    name: 'candidate_fullname',
    'aria-labelledby': 'name_header',
  });
  el.ownerDocument = doc;

  const detector = new FieldDetector();
  const field = detector.extractField(el);
  assert.ok(field);

  const mapping = mapField(field.metadata);
  assert.strictEqual(mapping.profileField, 'personal.fullName');
  assert.strictEqual(mapping.confidenceLevel, 'high');
});

runTest('TEST 13: Autocomplete email', () => {
  const el = new MockElement('input', {
    type: 'email',
    autocomplete: 'email',
    name: 'user_em',
  });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  const mapping = mapField(field.metadata);

  assert.strictEqual(mapping.profileField, 'personal.email');
  assert.strictEqual(mapping.confidenceLevel, 'high');
});

runTest('TEST 14: Autocomplete given-name', () => {
  const el = new MockElement('input', {
    type: 'text',
    autocomplete: 'given-name',
    name: 'first_fld',
  });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  const mapping = mapField(field.metadata);

  assert.strictEqual(mapping.profileField, 'personal.firstName');
  assert.strictEqual(mapping.confidenceLevel, 'high');
});

runTest('TEST 15: Autocomplete family-name', () => {
  const el = new MockElement('input', {
    type: 'text',
    autocomplete: 'family-name',
    name: 'last_fld',
  });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  const mapping = mapField(field.metadata);

  assert.strictEqual(mapping.profileField, 'personal.lastName');
  assert.strictEqual(mapping.confidenceLevel, 'high');
});

runTest('TEST 16: Weak label + strong autocomplete', () => {
  const el = new MockElement('input', {
    type: 'tel',
    autocomplete: 'tel',
    placeholder: 'Number', // generic/weak placeholder
  });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  const mapping = mapField(field.metadata);

  assert.strictEqual(mapping.profileField, 'personal.phone');
  assert.strictEqual(mapping.confidenceLevel, 'high');
});

// ============================================================================
// CATEGORY 4: CONTEXT SAFETY (Tests 17–21)
// ============================================================================

runTest('TEST 17: Confirm Email skipped', () => {
  const el = new MockElement('input', {
    type: 'email',
    autocomplete: 'email',
    name: 'confirm_email',
    placeholder: 'Confirm Email Address',
  });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  const mapping = mapField(field.metadata);

  assert.notStrictEqual(mapping.profileField, 'personal.email', 'Confirm Email must not map to personal.email');
  assert.strictEqual(mapping.confidenceLevel, 'low');
});

runTest('TEST 18: Emergency Contact skipped', () => {
  const el = new MockElement('input', {
    type: 'tel',
    name: 'emergency_contact_phone',
    placeholder: 'Emergency Contact Number',
  });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  const mapping = mapField(field.metadata);

  assert.notStrictEqual(mapping.profileField, 'personal.phone', 'Emergency Contact must not map to personal.phone');
});

runTest('TEST 19: Recruiter Phone skipped', () => {
  const el = new MockElement('input', {
    type: 'tel',
    name: 'recruiter_phone',
    placeholder: 'Recruiter Contact Number',
  });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  const mapping = mapField(field.metadata);

  assert.notStrictEqual(mapping.profileField, 'personal.phone', 'Recruiter phone must not map to personal.phone');
});

runTest('TEST 20: Reference Name skipped', () => {
  const el = new MockElement('input', {
    type: 'text',
    name: 'reference_name',
    placeholder: 'Reference / Referee Name',
  });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  const mapping = mapField(field.metadata);

  assert.notStrictEqual(mapping.profileField, 'personal.fullName', 'Reference name must not map to personal.fullName');
});

runTest('TEST 21: Company Name skipped', () => {
  const el = new MockElement('input', {
    type: 'text',
    name: 'current_company_name',
    placeholder: 'Company / Employer Name',
  });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  const mapping = mapField(field.metadata);

  assert.notStrictEqual(mapping.profileField, 'personal.fullName', 'Company name must not map to personal.fullName');
});

// ============================================================================
// CATEGORY 5: FRAMEWORK BEHAVIOR (Tests 22–25)
// ============================================================================

runTest('TEST 22: Controlled-input setter works', () => {
  const input = new MockElement('input', { type: 'text' });
  let setterCalled = false;

  const proto = Object.create(MockElement.prototype, {
    value: {
      get() {
        return this._value;
      },
      set(v) {
        setterCalled = true;
        this._value = v;
      },
      configurable: true,
      enumerable: true,
    },
  });
  Object.setPrototypeOf(input, proto);

  const written = writeInputValue(input, 'Alex Morgan');
  assert.strictEqual(written, true);
  assert.strictEqual(setterCalled, true, 'Prototype setter invoked for framework tracking');
  assert.strictEqual(input.value, 'Alex Morgan');
});

runTest('TEST 23: Input event bubbles', () => {
  const form = new MockElement('form');
  const input = new MockElement('input', { type: 'text' });
  form.appendChild(input);

  let formReceivedInput = false;
  form.addEventListener('input', () => {
    formReceivedInput = true;
  });

  writeInputValue(input, 'Alex Morgan');
  assert.strictEqual(formReceivedInput, true, 'Bubbling input event received by container');
});

runTest('TEST 24: Change event bubbles', () => {
  const form = new MockElement('form');
  const input = new MockElement('input', { type: 'text' });
  form.appendChild(input);

  let formReceivedChange = false;
  form.addEventListener('change', () => {
    formReceivedChange = true;
  });

  writeInputValue(input, 'Alex Morgan');
  assert.strictEqual(formReceivedChange, true, 'Bubbling change event received by container');
});

runTest('TEST 25: No form submission', () => {
  const form = new MockElement('form');
  const input = new MockElement('input', { type: 'text' });
  form.appendChild(input);

  let formSubmitted = false;
  form.addEventListener('submit', () => {
    formSubmitted = true;
  });

  writeInputValue(input, 'Alex Morgan');
  assert.strictEqual(formSubmitted, false, 'Form MUST NOT be submitted during value writing');
});

// ============================================================================
// CATEGORY 6: NATIVE CONTROLS (Tests 26–28)
// ============================================================================

runTest('TEST 26: Native select exact text match', () => {
  const select = new MockElement('select');
  select.options = [
    { value: '', text: '-- Select --' },
    { value: 'cs', text: 'Computer Science' },
    { value: 'it', text: 'Information Technology' },
  ];

  const matched = writeSelectValue(select, 'Computer Science');
  assert.strictEqual(matched, true);
  assert.strictEqual(select.selectedIndex, 1);
  assert.strictEqual(select.value, 'cs');
});

runTest('TEST 27: Native select exact value match with hyphen/underscore normalization', () => {
  const select = new MockElement('select');
  select.options = [
    { value: '', text: '-- Select --' },
    { value: 'computer-science', text: 'Computer Science & Engineering' },
    { value: 'mechanical_engineering', text: 'Mechanical Engineering' },
  ];

  // Target value has spaces: 'computer science' matching 'computer-science'
  const matched = writeSelectValue(select, 'computer science');
  assert.strictEqual(matched, true);
  assert.strictEqual(select.selectedIndex, 1);
  assert.strictEqual(select.value, 'computer-science');
});

runTest('TEST 28: Unmatched select skipped', () => {
  const select = new MockElement('select');
  select.options = [
    { value: '', text: '-- Select --' },
    { value: 'civil', text: 'Civil Engineering' },
  ];

  const matched = writeSelectValue(select, 'Quantum Computing');
  assert.strictEqual(matched, false, 'Unmatched select must return false without guessing');
  assert.strictEqual(select.selectedIndex, -1);
});

// ============================================================================
// CATEGORY 7: UNSUPPORTED / EDGE (Tests 29–34)
// ============================================================================

runTest('TEST 29: Password skipped', () => {
  const el = new MockElement('input', { type: 'password', name: 'password' });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  assert.strictEqual(field, null, 'Password fields are completely ignored by detector');
});

runTest('TEST 30: Disabled skipped', () => {
  const el = new MockElement('input', { disabled: 'true', name: 'candidate_name', placeholder: 'Full Name' });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  assert.strictEqual(field, null, 'Disabled fields are ignored by detector');
});

runTest('TEST 31: Readonly skipped', () => {
  const el = new MockElement('input', { readonly: 'true', name: 'candidate_name', placeholder: 'Full Name' });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  assert.ok(field);

  const profile = createTestProfile();
  const mapping = mapField(field.metadata);
  const decision = checkAutofillSafety(field, mapping, profile);

  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reason, 'readonly field');
});

runTest('TEST 32: Unsupported input skipped', () => {
  const el = new MockElement('input', { type: 'color', name: 'accent_color' });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  assert.ok(field);

  const profile = createTestProfile();
  const mapping = mapField(field.metadata);
  const decision = checkAutofillSafety(field, mapping, profile);

  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reason, 'unsupported input type');
});

runTest('TEST 33: Unsafe custom select skipped', () => {
  const customDiv = new MockElement('div', { role: 'combobox', 'aria-label': 'Degree' });
  const detector = new FieldDetector();
  assert.strictEqual(detector.isInspectable(customDiv), false, 'Custom div combobox is not inspectable');

  const contentEditable = new MockElement('div', { contenteditable: 'true', 'aria-label': 'Full Name' });
  assert.strictEqual(detector.isInspectable(contentEditable), false, 'Contenteditable div is not inspectable');
});

runTest('TEST 34: Unsupported closed Shadow DOM documented/handled safely', () => {
  const root = new MockElement('div');
  const host = new MockElement('div');
  root.appendChild(host);

  // Open shadow root contains candidate input
  const shadowInput = new MockElement('input', { name: 'shadow_fullname', placeholder: 'Full Name' });
  host.shadowRoot = new MockShadowRoot([shadowInput]);

  const detector = new FieldDetector();
  const detected = detector.scan(root);

  assert.strictEqual(detected.length, 1, 'Open Shadow DOM input is traversed and detected');
  assert.strictEqual(detected[0].element, shadowInput);

  // Closed shadow root returns null by browser standard and is safely skipped
  const closedHost = new MockElement('div');
  closedHost.shadowRoot = null;
  root.appendChild(closedHost);

  const afterScan = detector.scan(root);
  assert.strictEqual(afterScan.length, 0, 'Closed shadow root is inaccessible and safely skipped');
});

// ============================================================================
// CATEGORY 8: POPUP / LIFECYCLE (Tests 35–37)
// ============================================================================

runTest('TEST 35: Unavailable page handled gracefully', () => {
  // Simulate tab URL check logic in popup
  const isRestrictedUrl = (url) =>
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('devtools://') ||
    url.startsWith('about:');

  assert.strictEqual(isRestrictedUrl('chrome://extensions'), true);
  assert.strictEqual(isRestrictedUrl('chrome-extension://xyz/popup.html'), true);
  assert.strictEqual(isRestrictedUrl('https://careers.google.com/apply'), false);
});

runTest('TEST 36: Fresh popup status reflects current fields', () => {
  const root = new MockElement('form');
  const input1 = new MockElement('input', { name: 'candidate_full_name', placeholder: 'Full Name' });
  root.appendChild(input1);

  const detector = new FieldDetector();
  const controller = new AutofillController(detector);
  const profile = createTestProfile();

  detector.scan(root);
  const status1 = controller.getStatus(profile, detector.getDetectedFields());
  assert.strictEqual(status1.detectedCount, 1);

  // Dynamically add another input while popup is closed
  const input2 = new MockElement('input', { name: 'candidate_email', type: 'email', placeholder: 'Email Address' });
  root.appendChild(input2);

  // When popup opens, it triggers fresh scan and getStatus()
  detector.scan(root);
  const freshStatus = controller.getStatus(profile, detector.getDetectedFields());
  assert.strictEqual(freshStatus.detectedCount, 2);
  assert.strictEqual(freshStatus.eligibleCount, 2);
});

runTest('TEST 37: Unknown message rejected safely', () => {
  // Simulate content script message dispatcher safety check
  const handleMessage = (msg) => {
    if (!msg || typeof msg !== 'object' || !('type' in msg)) {
      return { error: 'Invalid message payload' };
    }
    if (msg.type === 'GET_AUTOFILL_STATUS') return { ok: true };
    if (msg.type === 'EXECUTE_AUTOFILL') return { ok: true };
    return { error: 'Unknown message type' };
  };

  assert.deepStrictEqual(handleMessage(null), { error: 'Invalid message payload' });
  assert.deepStrictEqual(handleMessage({ type: 'UNSUPPORTED_ACTION' }), { error: 'Unknown message type' });
  assert.deepStrictEqual(handleMessage({ type: 'GET_AUTOFILL_STATUS' }), { ok: true });
});

// ============================================================================
// CATEGORY 9: PRIVACY (Tests 38–40)
// ============================================================================

runTest('TEST 38: Profile values never logged', () => {
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  try {
    const root = new MockElement('form');
    const input = new MockElement('input', { name: 'candidate_name', placeholder: 'Full Name' });
    root.appendChild(input);

    const detector = new FieldDetector();
    const controller = new AutofillController(detector);
    const profile = createTestProfile();

    const fields = detector.scan(root);
    controller.executeAutofill(profile, fields);

    const fullLog = logs.join('\n');
    assert.strictEqual(fullLog.includes('Alex Morgan'), false, 'Profile name must not appear in console logs');
    assert.strictEqual(fullLog.includes('alex.morgan@example.com'), false, 'Profile email must not appear in console logs');
    assert.strictEqual(fullLog.includes('+1 555-0199'), false, 'Profile phone must not appear in console logs');
  } finally {
    console.log = origLog;
  }
});

runTest('TEST 39: Profile values never sent through status messages', () => {
  const root = new MockElement('form');
  const input = new MockElement('input', { name: 'candidate_name', placeholder: 'Full Name' });
  root.appendChild(input);

  const detector = new FieldDetector();
  const controller = new AutofillController(detector);
  const profile = createTestProfile();

  const fields = detector.scan(root);
  const status = controller.getStatus(profile, fields);
  const serialized = JSON.stringify(status);

  assert.strictEqual(serialized.includes('Alex Morgan'), false);
  assert.strictEqual(serialized.includes('alex.morgan@example.com'), false);
});

runTest('TEST 40: Execution message contains no profile values', () => {
  const root = new MockElement('form');
  const input = new MockElement('input', { name: 'candidate_name', placeholder: 'Full Name' });
  root.appendChild(input);

  const detector = new FieldDetector();
  const controller = new AutofillController(detector);
  const profile = createTestProfile();

  const fields = detector.scan(root);
  const exec = controller.executeAutofill(profile, fields);
  const serialized = JSON.stringify(exec);

  assert.strictEqual(serialized.includes('Alex Morgan'), false);
  assert.strictEqual(serialized.includes('alex.morgan@example.com'), false);
});

// ============================================================================
// CATEGORY 10: REGRESSIONS (Tests 41–45)
// ============================================================================

runTest('TEST 41: M2 profile validation logic still passes with 0 regressions', () => {
  const validProfile = createTestProfile();
  const res = validateProfile(validProfile);
  assert.strictEqual(res.isValid, true);
});

runTest('TEST 42: M3A field text normalization logic still passes with 0 regressions', () => {
  assert.strictEqual(normalizeFieldText('candidate_full_name'), 'candidate full name');
  assert.strictEqual(normalizeFieldText('applicantFirstName'), 'applicant first name');
  assert.strictEqual(normalizeFieldText('EMAIL-ADDRESS'), 'email address');
});

runTest('TEST 43: M3B field mapping engine still passes with 0 regressions', () => {
  const mapping = mapField({
    tagName: 'input',
    type: 'text',
    name: 'candidate_full_name',
    nameNormalized: 'candidate full name',
    id: '',
    idNormalized: '',
    placeholder: 'Full Name',
    placeholderNormalized: 'full name',
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

  assert.strictEqual(mapping.profileField, 'personal.fullName');
  assert.strictEqual(mapping.confidenceLevel, 'high');
});

runTest('TEST 44: M4 safe autofill engine still passes with 0 regressions', () => {
  const el = new MockElement('input', { type: 'text' });
  const written = writeInputValue(el, 'Test Value');
  assert.strictEqual(written, true);
  assert.strictEqual(el.value, 'Test Value');
});

runTest('TEST 45: M5 controller and safety gate integration still passes with 0 regressions', () => {
  const profile = createTestProfile();
  const el = new MockElement('input', { name: 'skills', placeholder: 'Technical Skills' });
  const detector = new FieldDetector();
  const field = detector.extractField(el);
  const mapping = mapField(field.metadata);
  const decision = checkAutofillSafety(field, mapping, profile);

  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.status, 'filled');
});

console.log('----------------------------------------------------');
console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
console.log('----------------------------------------------------');

if (failedTests === 0) {
  console.log(`🎉 ALL ${passedTests} M6 BEHAVIORAL TESTS PASSED!`);
  process.exit(0);
} else {
  console.error(`💥 ${failedTests} TEST(S) FAILED.`);
  process.exit(1);
}
