import assert from 'assert';
import { FieldDetector } from '../src/content/field-detector.ts';
import { DynamicFormObserver } from '../src/content/mutation-observer.ts';
import { normalizeFieldText } from '../src/utils/normalize-field.ts';
import {
  findExplicitLabel,
  findWrappedLabel,
  findAriaLabel,
  findAriaLabelledBy,
  findSurroundingText,
  resolveLabelSignals,
} from '../src/content/label-detector.ts';

console.log('----------------------------------------------------');
console.log('🧪 Running FILLO Field Detector Behavioral Tests...');
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
 * Lightweight mock DOM Element for behavioral testing without heavy external dependencies.
 */
class MockElement {
  constructor(tagName, attrs = {}, textContent = '') {
    this.tagName = tagName.toUpperCase();
    this.attrs = new Map();
    this.children = [];
    this.parentElement = null;
    this.ownerDocument = null;
    this._textContent = textContent;
    this.disabled = false;

    for (const [k, v] of Object.entries(attrs)) {
      this.setAttribute(k, v);
    }
  }

  get id() {
    return this.attrs.get('id') || '';
  }

  set id(val) {
    this.attrs.set('id', val);
  }

  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  setAttribute(name, value) {
    this.attrs.set(name, String(value));
    if (name === 'disabled') {
      this.disabled = true;
    }
  }

  hasAttribute(name) {
    return this.attrs.has(name);
  }

  get textContent() {
    if (this._textContent) return this._textContent;
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

  appendChild(child) {
    child.parentElement = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    if (this.ownerDocument && this.ownerDocument._onNodeAdded) {
      this.ownerDocument._onNodeAdded(child);
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) {
        this.parentElement.children.splice(idx, 1);
      }
      this.parentElement = null;
    }
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
    const clone = new MockElement(this.tagName.toLowerCase(), Object.fromEntries(this.attrs), this._textContent);
    clone.disabled = this.disabled;
    if (deep) {
      for (const c of this.children) {
        clone.appendChild(c.cloneNode(true));
      }
    }
    return clone;
  }

  querySelectorAll(selector) {
    const results = [];
    const selLower = selector.toLowerCase();
    const selTags = selLower.split(',').map((s) => s.trim().toUpperCase());

    const isMatch = (el) => {
      // Attribute selector: label[for="..."]
      const forMatch = selLower.match(/label\[for="([^"]+)"\]/);
      if (forMatch) {
        return el.tagName === 'LABEL' && el.getAttribute('for') === forMatch[1];
      }
      return selTags.includes(el.tagName);
    };

    const traverse = (node) => {
      for (const child of node.children) {
        if (isMatch(child)) {
          results.push(child);
        }
        traverse(child);
      }
    };

    traverse(this);
    return results;
  }

  querySelector(selector) {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement('body');
    this.body.ownerDocument = this;
    this._idMap = new Map();
    this._onNodeAdded = null;
  }

  getElementById(id) {
    const traverse = (node) => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = traverse(child);
        if (found) return found;
      }
      return null;
    };
    return traverse(this.body);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

// ----------------------------------------------------
// TEST CASES (1 to 16)
// ----------------------------------------------------

// TEST 1: Explicit <label for=""> detection
runTest('TEST 1: Explicit <label for=""> detection', () => {
  const doc = new MockDocument();
  const label = new MockElement('label', { for: 'user-email' }, 'Email Address');
  const input = new MockElement('input', { id: 'user-email', type: 'email' });
  doc.body.appendChild(label);
  doc.body.appendChild(input);

  const detectedLabel = findExplicitLabel(input);
  assert.strictEqual(detectedLabel, 'Email Address');

  const detector = new FieldDetector();
  const field = detector.extractField(input);
  assert.ok(field);
  assert.strictEqual(field.metadata.labelText, 'Email Address');
  assert.strictEqual(field.metadata.labelTextNormalized, 'email address');
});

// TEST 2: Wrapped <label> detection
runTest('TEST 2: Wrapped <label> detection', () => {
  const label = new MockElement('label', {}, 'Phone Number');
  const input = new MockElement('input', { type: 'tel', name: 'phone' });
  label.appendChild(input);

  const detectedLabel = findWrappedLabel(input);
  assert.strictEqual(detectedLabel, 'Phone Number');

  const detector = new FieldDetector();
  const field = detector.extractField(input);
  assert.ok(field);
  assert.strictEqual(field.metadata.labelText, 'Phone Number');
  assert.strictEqual(field.metadata.labelTextNormalized, 'phone number');
});

// TEST 3: aria-label detection
runTest('TEST 3: aria-label detection', () => {
  const input = new MockElement('input', { 'aria-label': 'Educational Institution' });
  const detectedAria = findAriaLabel(input);
  assert.strictEqual(detectedAria, 'Educational Institution');

  const detector = new FieldDetector();
  const field = detector.extractField(input);
  assert.ok(field);
  assert.strictEqual(field.metadata.ariaLabel, 'Educational Institution');
  assert.strictEqual(field.metadata.ariaLabelNormalized, 'educational institution');
  assert.strictEqual(field.metadata.labelText, 'Educational Institution');
});

// TEST 4: aria-labelledby detection
runTest('TEST 4: aria-labelledby detection', () => {
  const doc = new MockDocument();
  const span = new MockElement('span', { id: 'portfolio-heading' }, 'Personal Portfolio');
  const input = new MockElement('input', { 'aria-labelledby': 'portfolio-heading' });
  doc.body.appendChild(span);
  doc.body.appendChild(input);

  const detected = findAriaLabelledBy(input);
  assert.strictEqual(detected, 'Personal Portfolio');

  const detector = new FieldDetector();
  const field = detector.extractField(input);
  assert.ok(field);
  assert.strictEqual(field.metadata.ariaLabelledBy, 'portfolio-heading');
  assert.strictEqual(field.metadata.labelText, 'Personal Portfolio');
});

// TEST 5: placeholder extraction
runTest('TEST 5: placeholder extraction', () => {
  const input = new MockElement('input', { placeholder: 'Enter your full name' });
  const detector = new FieldDetector();
  const field = detector.extractField(input);
  assert.ok(field);
  assert.strictEqual(field.metadata.placeholder, 'Enter your full name');
  assert.strictEqual(field.metadata.placeholderNormalized, 'enter your full name');
});

// TEST 6: name/id extraction
runTest('TEST 6: name/id extraction', () => {
  const input = new MockElement('input', { name: 'candidate_first_name', id: 'candidateFirstName' });
  const detector = new FieldDetector();
  const field = detector.extractField(input);
  assert.ok(field);
  assert.strictEqual(field.metadata.name, 'candidate_first_name');
  assert.strictEqual(field.metadata.nameNormalized, 'candidate first name');
  assert.strictEqual(field.metadata.id, 'candidateFirstName');
  assert.strictEqual(field.metadata.idNormalized, 'candidate first name');
});

// TEST 7: autocomplete extraction
runTest('TEST 7: autocomplete extraction', () => {
  const input = new MockElement('input', { autocomplete: 'given-name' });
  const detector = new FieldDetector();
  const field = detector.extractField(input);
  assert.ok(field);
  assert.strictEqual(field.metadata.autocomplete, 'given-name');
  assert.strictEqual(field.metadata.autocompleteNormalized, 'given name');
});

// TEST 8: Normalization
runTest('TEST 8: Normalization across camelCase, snake_case, screaming snake, and separators', () => {
  assert.strictEqual(normalizeFieldText('candidate_full_name'), 'candidate full name');
  assert.strictEqual(normalizeFieldText('CandidateName'), 'candidate name');
  assert.strictEqual(normalizeFieldText('candidateFirstName'), 'candidate first name');
  assert.strictEqual(normalizeFieldText('EMAIL_ADDRESS'), 'email address');
  assert.strictEqual(normalizeFieldText('  phone-number-field  '), 'phone number field');
  assert.strictEqual(normalizeFieldText(''), '');
  assert.strictEqual(normalizeFieldText(null), '');
});

// TEST 9: Hidden fields ignored
runTest('TEST 9: Hidden fields ignored', () => {
  const input = new MockElement('input', { type: 'hidden', name: 'csrf_token' });
  const detector = new FieldDetector();
  assert.strictEqual(detector.isInspectable(input), false);
  assert.strictEqual(detector.extractField(input), null);
});

// TEST 10: Password fields ignored
runTest('TEST 10: Password fields ignored', () => {
  const input = new MockElement('input', { type: 'password', name: 'pass' });
  const detector = new FieldDetector();
  assert.strictEqual(detector.isInspectable(input), false);
  assert.strictEqual(detector.extractField(input), null);
});

// TEST 11: Disabled fields ignored
runTest('TEST 11: Disabled fields ignored', () => {
  const input = new MockElement('input', { type: 'text', disabled: 'disabled' });
  const detector = new FieldDetector();
  assert.strictEqual(detector.isInspectable(input), false);
  assert.strictEqual(detector.extractField(input), null);

  const ariaDisabled = new MockElement('input', { type: 'text', 'aria-disabled': 'true' });
  assert.strictEqual(detector.isInspectable(ariaDisabled), false);
});

// TEST 12: Submit/reset/button controls ignored
runTest('TEST 12: Submit/reset/button controls ignored', () => {
  const submit = new MockElement('input', { type: 'submit', value: 'Submit' });
  const reset = new MockElement('input', { type: 'reset', value: 'Reset' });
  const btn = new MockElement('input', { type: 'button', value: 'Click' });
  const detector = new FieldDetector();

  assert.strictEqual(detector.isInspectable(submit), false);
  assert.strictEqual(detector.isInspectable(reset), false);
  assert.strictEqual(detector.isInspectable(btn), false);
});

// TEST 13: Textarea detected
runTest('TEST 13: Textarea detected', () => {
  const textarea = new MockElement('textarea', { name: 'bio', placeholder: 'Tell us about yourself' });
  const detector = new FieldDetector();
  assert.strictEqual(detector.isInspectable(textarea), true);

  const field = detector.extractField(textarea);
  assert.ok(field);
  assert.strictEqual(field.metadata.tagName, 'textarea');
  assert.strictEqual(field.metadata.type, 'textarea');
  assert.strictEqual(field.metadata.placeholder, 'Tell us about yourself');
});

// TEST 14: Select detected
runTest('TEST 14: Select detected', () => {
  const select = new MockElement('select', { name: 'degree_type' });
  const detector = new FieldDetector();
  assert.strictEqual(detector.isInspectable(select), true);

  const field = detector.extractField(select);
  assert.ok(field);
  assert.strictEqual(field.metadata.tagName, 'select');
  assert.strictEqual(field.metadata.type, 'select');
  assert.strictEqual(field.metadata.nameNormalized, 'degree type');
});

// TEST 15: Duplicate detection prevention
runTest('TEST 15: Duplicate detection prevention with WeakSet', () => {
  const input = new MockElement('input', { id: 'email', name: 'email' });
  const detector = new FieldDetector();

  const first = detector.extractField(input);
  assert.ok(first);

  const second = detector.extractField(input);
  assert.strictEqual(second, null, 'Re-extracting same DOM element returns null');

  assert.strictEqual(detector.getDetectedFields().length, 1);
});

// TEST 16: Dynamically inserted field detected
runTest('TEST 16: Dynamically inserted field detected via observer', (done) => {
  const doc = new MockDocument();
  const detector = new FieldDetector();

  // Initial field
  const initialInput = new MockElement('input', { name: 'initial_field' });
  doc.body.appendChild(initialInput);
  detector.scan(doc);
  assert.strictEqual(detector.getDetectedFields().length, 1);

  // Dynamically added field
  const dynamicInput = new MockElement('input', { name: 'dynamic_field' });
  doc.body.appendChild(dynamicInput);

  // Run scan after dynamic insertion
  const newFields = detector.scan(doc);
  assert.strictEqual(newFields.length, 1);
  assert.strictEqual(newFields[0].metadata.name, 'dynamic_field');
  assert.strictEqual(detector.getDetectedFields().length, 2);
});

console.log('----------------------------------------------------');
console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
console.log('----------------------------------------------------');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL 16 FIELD DETECTOR BEHAVIORAL TESTS PASSED!');
  process.exit(0);
}
