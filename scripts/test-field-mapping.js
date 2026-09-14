import assert from 'assert';
import { mapField } from '../src/mapping/mapper.ts';
import { normalizeFieldText } from '../src/utils/normalize-field.ts';

console.log('----------------------------------------------------');
console.log('🧪 Running FILLO Field Mapping Behavioral Tests (M3B)...');
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

function createMeta(partial = {}) {
  const name = partial.name || '';
  const id = partial.id || '';
  const placeholder = partial.placeholder || '';
  const ariaLabel = partial.ariaLabel || '';
  const autocomplete = partial.autocomplete || '';
  const labelText = partial.labelText || '';
  const surroundingText = partial.surroundingText || '';

  return {
    tagName: partial.tagName || 'input',
    type: partial.type || 'text',
    name,
    nameNormalized: normalizeFieldText(name),
    id,
    idNormalized: normalizeFieldText(id),
    placeholder,
    placeholderNormalized: normalizeFieldText(placeholder),
    ariaLabel,
    ariaLabelNormalized: normalizeFieldText(ariaLabel),
    ariaLabelledBy: partial.ariaLabelledBy || '',
    autocomplete,
    autocompleteNormalized: normalizeFieldText(autocomplete),
    labelText,
    labelTextNormalized: normalizeFieldText(labelText),
    surroundingText,
    surroundingTextNormalized: normalizeFieldText(surroundingText),
  };
}

// ----------------------------------------------------
// 30 BEHAVIORAL TESTS
// ----------------------------------------------------

// TEST 1: "Full Name" -> personal.fullName -> HIGH
runTest('TEST 1: "Full Name" -> personal.fullName (HIGH)', () => {
  const meta = createMeta({ labelText: 'Full Name', name: 'full_name', autocomplete: 'name' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.fullName');
  assert.strictEqual(result.confidenceLevel, 'high');
  assert.ok(result.confidence >= 0.85);
});

// TEST 2: "Candidate Name" -> personal.fullName
runTest('TEST 2: "Candidate Name" -> personal.fullName', () => {
  const meta = createMeta({ labelText: 'Candidate Name' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.fullName');
});

// TEST 3: "candidate_full_name" -> personal.fullName
runTest('TEST 3: "candidate_full_name" -> personal.fullName', () => {
  const meta = createMeta({ name: 'candidate_full_name' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.fullName');
});

// TEST 4: "First Name" -> personal.firstName
runTest('TEST 4: "First Name" -> personal.firstName', () => {
  const meta = createMeta({ labelText: 'First Name', name: 'first_name' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.firstName');
});

// TEST 5: "Given Name" -> personal.firstName
runTest('TEST 5: "Given Name" -> personal.firstName', () => {
  const meta = createMeta({ labelText: 'Given Name' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.firstName');
});

// TEST 6: "Last Name" -> personal.lastName
runTest('TEST 6: "Last Name" -> personal.lastName', () => {
  const meta = createMeta({ labelText: 'Last Name', name: 'last_name' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.lastName');
});

// TEST 7: "Surname" -> personal.lastName
runTest('TEST 7: "Surname" -> personal.lastName', () => {
  const meta = createMeta({ labelText: 'Surname' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.lastName');
});

// TEST 8: "Email Address" -> personal.email
runTest('TEST 8: "Email Address" -> personal.email', () => {
  const meta = createMeta({ labelText: 'Email Address', type: 'email', name: 'email' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.email');
  assert.strictEqual(result.confidenceLevel, 'high');
});

// TEST 9: "Mobile Number" -> personal.phone
runTest('TEST 9: "Mobile Number" -> personal.phone', () => {
  const meta = createMeta({ labelText: 'Mobile Number', type: 'tel', name: 'mobile' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.phone');
});

// TEST 10: "University / College" -> education.college
runTest('TEST 10: "University / College" -> education.college', () => {
  const meta = createMeta({ labelText: 'University / College', name: 'university' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'education.college');
});

// TEST 11: "Educational Institution" -> education.college
runTest('TEST 11: "Educational Institution" -> education.college', () => {
  const meta = createMeta({ labelText: 'Educational Institution' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'education.college');
});

// TEST 12: "Degree" -> education.degree
runTest('TEST 12: "Degree" -> education.degree', () => {
  const meta = createMeta({ labelText: 'Degree', name: 'degree_name' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'education.degree');
});

// TEST 13: "Major / Specialization" -> education.branch
runTest('TEST 13: "Major / Specialization" -> education.branch', () => {
  const meta = createMeta({ labelText: 'Major / Specialization', name: 'specialization' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'education.branch');
});

// TEST 14: "CGPA" -> education.cgpa
runTest('TEST 14: "CGPA" -> education.cgpa', () => {
  const meta = createMeta({ labelText: 'CGPA', name: 'cgpa', type: 'number' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'education.cgpa');
});

// TEST 15: "Graduation Year" -> education.graduationYear
runTest('TEST 15: "Graduation Year" -> education.graduationYear', () => {
  const meta = createMeta({ labelText: 'Graduation Year', name: 'grad_year' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'education.graduationYear');
});

// TEST 16: "GitHub Profile" -> online.github
runTest('TEST 16: "GitHub Profile" -> online.github', () => {
  const meta = createMeta({ labelText: 'GitHub Profile', name: 'github_url', type: 'url' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'online.github');
});

// TEST 17: "LinkedIn URL" -> online.linkedin
runTest('TEST 17: "LinkedIn URL" -> online.linkedin', () => {
  const meta = createMeta({ labelText: 'LinkedIn URL', name: 'linkedin_profile', type: 'url' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'online.linkedin');
});

// TEST 18: "Portfolio Website" -> online.portfolio
runTest('TEST 18: "Portfolio Website" -> online.portfolio', () => {
  const meta = createMeta({ labelText: 'Portfolio Website', name: 'portfolio_link', type: 'url' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'online.portfolio');
});

// TEST 19: "Technical Skills" -> skills
runTest('TEST 19: "Technical Skills" -> skills', () => {
  const meta = createMeta({ labelText: 'Technical Skills', tagName: 'textarea', name: 'skills' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'skills');
});

// TEST 20: "City / Location" -> personal.location
runTest('TEST 20: "City / Location" -> personal.location', () => {
  const meta = createMeta({ labelText: 'City / Location', name: 'current_city' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.location');
});

// TEST 21: "Company Name" -> NOT personal.fullName
runTest('TEST 21: "Company Name" -> NOT personal.fullName', () => {
  const meta = createMeta({ labelText: 'Company Name', name: 'company_name' });
  const result = mapField(meta);
  assert.notStrictEqual(result.profileField, 'personal.fullName');
});

// TEST 22: "Emergency Contact" -> NOT personal.phone
runTest('TEST 22: "Emergency Contact" -> NOT personal.phone', () => {
  const meta = createMeta({ labelText: 'Emergency Contact', name: 'emergency_contact_phone' });
  const result = mapField(meta);
  assert.notStrictEqual(result.profileField, 'personal.phone');
});

// TEST 23: "Username" -> NOT personal.fullName
runTest('TEST 23: "Username" -> NOT personal.fullName', () => {
  const meta = createMeta({ labelText: 'Username', name: 'user_login' });
  const result = mapField(meta);
  assert.notStrictEqual(result.profileField, 'personal.fullName');
});

// TEST 24: Ambiguous "Name" -> LOW confidence / alternatives
runTest('TEST 24: Ambiguous "Name" -> LOW confidence / alternatives', () => {
  const meta = createMeta({ labelText: 'Name' });
  const result = mapField(meta);
  assert.strictEqual(result.confidenceLevel, 'low');
  assert.ok(result.alternatives.length > 0);
  assert.ok(
    result.reasons.some((r) => r.toLowerCase().includes('ambiguous'))
  );
});

// TEST 25: Email input type with weak/no label -> email receives supporting evidence
runTest('TEST 25: Email input type with weak/no label -> email receives supporting evidence', () => {
  const meta = createMeta({ type: 'email' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.email');
  assert.ok(result.reasons.some((r) => r.includes('input type "email"')));
});

// TEST 26: Autocomplete "given-name" -> firstName receives strong evidence
runTest('TEST 26: Autocomplete "given-name" -> firstName receives strong evidence', () => {
  const meta = createMeta({ autocomplete: 'given-name' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.firstName');
  assert.ok(result.reasons.some((r) => r.includes('autocomplete matched "given-name"')));
});

// TEST 27: Autocomplete "family-name" -> lastName receives strong evidence
runTest('TEST 27: Autocomplete "family-name" -> lastName receives strong evidence', () => {
  const meta = createMeta({ autocomplete: 'family-name' });
  const result = mapField(meta);
  assert.strictEqual(result.profileField, 'personal.lastName');
  assert.ok(result.reasons.some((r) => r.includes('autocomplete matched "family-name"')));
});

// TEST 28: Multiple supporting signals -> score higher than a single weak signal
runTest('TEST 28: Multiple supporting signals -> score higher than a single weak signal', () => {
  const weakMeta = createMeta({ placeholder: 'email' });
  const strongMeta = createMeta({
    labelText: 'Email Address',
    name: 'candidate_email',
    autocomplete: 'email',
    type: 'email',
  });

  const weakResult = mapField(weakMeta);
  const strongResult = mapField(strongMeta);

  assert.ok(strongResult.confidence > weakResult.confidence);
  assert.strictEqual(strongResult.confidenceLevel, 'high');
});

// TEST 29: Conflicting signals -> ambiguity represented instead of blindly selecting
runTest('TEST 29: Conflicting signals -> ambiguity represented instead of blindly selecting', () => {
  // Label says "First Name", but name attribute says "last_name"
  const conflictingMeta = createMeta({ labelText: 'First Name', name: 'last_name' });
  const result = mapField(conflictingMeta);

  // Should have competing alternatives with close scores
  assert.ok(result.alternatives.length > 0);
  const competing = result.alternatives.find(
    (a) => a.profileField === 'personal.firstName' || a.profileField === 'personal.lastName'
  );
  assert.ok(competing);
});

// TEST 30: Case/spacing/underscore/camelCase variations -> consistent mapping
runTest('TEST 30: Case/spacing/underscore/camelCase variations -> consistent mapping', () => {
  const m1 = createMeta({ name: 'candidate_full_name' });
  const m2 = createMeta({ name: 'CandidateFullName' });
  const m3 = createMeta({ name: 'CANDIDATE_FULL_NAME' });
  const m4 = createMeta({ labelText: '  candidate   full   name  ' });

  assert.strictEqual(mapField(m1).profileField, 'personal.fullName');
  assert.strictEqual(mapField(m2).profileField, 'personal.fullName');
  assert.strictEqual(mapField(m3).profileField, 'personal.fullName');
  assert.strictEqual(mapField(m4).profileField, 'personal.fullName');
});

console.log('----------------------------------------------------');
console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
console.log('----------------------------------------------------');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL 30 FIELD MAPPING BEHAVIORAL TESTS PASSED!');
  process.exit(0);
}
