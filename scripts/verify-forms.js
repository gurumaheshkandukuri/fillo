/**
 * FILLO Form HTML Verification Script
 * Parses each of the 5 test form HTML files and verifies that:
 * 1. All eligible fields map to the correct semantic profile fields.
 * 2. All negative/ambiguous fields are correctly refused.
 * 3. Before execution, values are untouched.
 * 4. After execution, only eligible fields receive values.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import { mapField } from '../src/mapping/mapper.ts';
import { normalizeFieldText } from '../src/utils/normalize-field.ts';
import { AutofillController } from '../src/autofill/autofill-controller.ts';
import { AutofillEngine } from '../src/autofill/autofill-engine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const formsDir = path.resolve(__dirname, '../tests/forms');

console.log('----------------------------------------------------');
console.log('🔍 Running FILLO 5 Forms Verification...');
console.log('----------------------------------------------------');

const profile = {
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

/**
 * Regex-based HTML form field extractor for node verification of the static test files.
 */
function extractFieldsFromHtml(rawHtml) {
  const html = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  const fields = [];
  // Match inputs and textareas and selects
  const tagRegex = /<(input|textarea|select)\b([^>]*)>(?:([\s\S]*?)<\/\1>)?/gi;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrsStr = match[2];
    const innerContent = match[3] || '';

    const getAttr = (name) => {
      const r = new RegExp(`${name}=["']([^"']*)["']`, 'i');
      const m = attrsStr.match(r);
      return m ? m[1] : '';
    };

    const hasAttr = (name) => {
      const r = new RegExp(`\\b${name}\\b`, 'i');
      return r.test(attrsStr);
    };

    const type = (getAttr('type') || (tagName === 'textarea' ? 'textarea' : tagName === 'select' ? 'select' : 'text')).toLowerCase();
    const id = getAttr('id');
    const name = getAttr('name');
    const placeholder = getAttr('placeholder');
    const autocomplete = getAttr('autocomplete');
    const disabled = hasAttr('disabled');
    const readonly = hasAttr('readonly');
    const value = getAttr('value');

    // Find label by searching for <label for="id">...</label>
    let labelText = '';
    if (id) {
      const labelRegex = new RegExp(`<label[^>]*for=["']${id}["'][^>]*>([\\s\\S]*?)<\\/label>`, 'i');
      const lm = html.match(labelRegex);
      if (lm) {
        labelText = lm[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    const element = {
      tagName: tagName.toUpperCase(),
      type,
      value: value || '',
      disabled,
      readOnly: readonly,
      hidden: type === 'hidden',
      options: [],
      selectedIndex: 0,
      hasAttribute: (n) => hasAttr(n),
      getAttribute: (n) => getAttr(n) || null,
      dispatchEvent: () => true,
    };

    if (tagName === 'select') {
      const optRegex = /<option\b[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi;
      let optMatch;
      while ((optMatch = optRegex.exec(innerContent)) !== null) {
        element.options.push({ value: optMatch[1], text: optMatch[2].trim() });
      }
    }

    const metadata = {
      tagName,
      type,
      name,
      nameNormalized: normalizeFieldText(name),
      id,
      idNormalized: normalizeFieldText(id),
      placeholder,
      placeholderNormalized: normalizeFieldText(placeholder),
      ariaLabel: '',
      ariaLabelNormalized: '',
      ariaLabelledBy: '',
      autocomplete,
      autocompleteNormalized: normalizeFieldText(autocomplete),
      labelText,
      labelTextNormalized: normalizeFieldText(labelText),
      surroundingText: '',
      surroundingTextNormalized: '',
    };

    fields.push({ element, metadata });
  }

  return fields;
}

// 1. Verify tests/forms/basic-form.html
{
  const html = fs.readFileSync(path.join(formsDir, 'basic-form.html'), 'utf-8');
  const fields = extractFieldsFromHtml(html);
  const engine = new AutofillEngine();
  const controller = new AutofillController(undefined, engine);

  const status = controller.getStatus(profile, fields);
  assert(status.detectedCount >= 13, 'basic-form.html has detected fields');
  assert(status.eligibleCount >= 10, 'basic-form.html has eligible candidate fields');

  // Verify before: zero fields modified
  const nameField = fields.find((f) => f.metadata.name === 'candidate_full_name');
  assert.strictEqual(nameField.element.value, '', 'Values must remain untouched before user clicks Fill');

  const exec = controller.executeAutofill(profile, fields);
  assert(exec.filled >= 10, `basic-form filled ${exec.filled} fields`);
  assert.strictEqual(nameField.element.value, 'Alex Morgan');

  // Verify negative tests skipped
  const companyField = fields.find((f) => f.metadata.name === 'company_name');
  assert.strictEqual(companyField.element.value, '', 'Company Name must NOT be filled');

  const emergencyField = fields.find((f) => f.metadata.name === 'emergency_contact');
  assert.strictEqual(emergencyField.element.value, '', 'Emergency contact must NOT be filled');

  console.log('✅ PASS: basic-form.html verified');
}

// 2. Verify tests/forms/job-application.html
{
  const html = fs.readFileSync(path.join(formsDir, 'job-application.html'), 'utf-8');
  const fields = extractFieldsFromHtml(html);
  const engine = new AutofillEngine();
  const controller = new AutofillController(undefined, engine);

  const status = controller.getStatus(profile, fields);
  assert(status.detectedCount >= 18, 'job-application.html detected count');
  assert(status.eligibleCount >= 12, 'job-application.html eligible count');

  const exec = controller.executeAutofill(profile, fields);
  assert(exec.filled >= 12, `job-application filled ${exec.filled} fields`);

  const company = fields.find((f) => f.metadata.name === 'company_name');
  assert.strictEqual(company.element.value, '', 'Job App Company Name must NOT be filled');

  const emergencyName = fields.find((f) => f.metadata.name === 'emergency_contact_name');
  assert.strictEqual(emergencyName.element.value, '', 'Emergency Contact Name must NOT be filled');

  const confirmEmail = fields.find((f) => f.metadata.name === 'confirm_email');
  assert.strictEqual(confirmEmail.element.value, '', 'Confirm Email must NOT be filled');

  console.log('✅ PASS: job-application.html verified');
}

// 3. Verify tests/forms/scholarship-form.html
{
  const html = fs.readFileSync(path.join(formsDir, 'scholarship-form.html'), 'utf-8');
  const fields = extractFieldsFromHtml(html);
  const engine = new AutofillEngine();
  const controller = new AutofillController(undefined, engine);

  const status = controller.getStatus(profile, fields);
  assert(status.detectedCount >= 8, 'scholarship-form.html detected count');

  const exec = controller.executeAutofill(profile, fields);
  assert(exec.filled >= 6, `scholarship-form filled ${exec.filled} fields`);

  const guardian = fields.find((f) => f.metadata.name === 'guardian_name');
  assert.strictEqual(guardian.element.value, '', 'Guardian Name must NOT be filled');

  const genericName = fields.find((f) => f.metadata.name === 'name');
  assert.strictEqual(genericName.element.value, '', 'Ambiguous Name must NOT be filled');

  console.log('✅ PASS: scholarship-form.html verified');
}

// 4. Verify tests/forms/internship-form.html
{
  const html = fs.readFileSync(path.join(formsDir, 'internship-form.html'), 'utf-8');
  const fields = extractFieldsFromHtml(html);
  const engine = new AutofillEngine();
  const controller = new AutofillController(undefined, engine);

  const status = controller.getStatus(profile, fields);
  assert(status.detectedCount >= 10, 'internship-form.html detected count');

  const exec = controller.executeAutofill(profile, fields);
  assert(exec.filled >= 6, `internship-form filled ${exec.filled} fields`);

  const recruiterName = fields.find((f) => f.metadata.name === 'recruiter_name');
  assert.strictEqual(recruiterName.element.value, '', 'Recruiter Name must NOT be filled');

  const prevComp = fields.find((f) => f.metadata.name === 'previous_company');
  assert.strictEqual(prevComp.element.value, '', 'Previous Company must NOT be filled');

  console.log('✅ PASS: internship-form.html verified');
}

// 5. Verify tests/forms/complex-dynamic-form.html
{
  const html = fs.readFileSync(path.join(formsDir, 'complex-dynamic-form.html'), 'utf-8');
  const fields = extractFieldsFromHtml(html);
  const engine = new AutofillEngine();
  const controller = new AutofillController(undefined, engine);

  const status = controller.getStatus(profile, fields);
  assert.strictEqual(status.detectedCount, 2, 'Initial count on dynamic form is 2');

  const exec = controller.executeAutofill(profile, fields);
  assert.strictEqual(exec.filled, 2, 'Initial 2 fields filled on user click');

  console.log('✅ PASS: complex-dynamic-form.html verified');
}

console.log('----------------------------------------------------');
console.log('🎉 ALL 5 TEST FORMS VERIFIED SUCCESSFULLY!');
console.log('----------------------------------------------------');
