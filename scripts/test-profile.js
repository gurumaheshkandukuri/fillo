import assert from 'assert';
import { createEmptyProfile } from '../src/types/profile.ts';
import { normalizeSkills, formatSkillsForDisplay } from '../src/utils/normalize.ts';
import { validateProfile } from '../src/utils/validation.ts';

console.log('----------------------------------------------------');
console.log('🧪 Running FILLO Profile Behavioral Tests...');
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
    console.error(err.message);
    failedTests++;
  }
}

// 1. Data Model Tests
runTest('createEmptyProfile returns full schema with structured skills array', () => {
  const empty = createEmptyProfile();
  assert.strictEqual(typeof empty.personal, 'object');
  assert.strictEqual(typeof empty.education, 'object');
  assert.strictEqual(typeof empty.online, 'object');
  assert.ok(Array.isArray(empty.skills));
  assert.strictEqual(empty.skills.length, 0);
  assert.strictEqual(empty.personal.fullName, '');
  assert.strictEqual(empty.education.college, '');
  assert.strictEqual(empty.online.github, '');
});

// 2. Skills Normalization Tests
runTest('normalizeSkills returns empty array for empty or whitespace input', () => {
  assert.deepStrictEqual(normalizeSkills(''), []);
  assert.deepStrictEqual(normalizeSkills('   '), []);
  assert.deepStrictEqual(normalizeSkills(null), []);
  assert.deepStrictEqual(normalizeSkills(undefined), []);
});

runTest('normalizeSkills trims items and removes empty entries', () => {
  const result = normalizeSkills('  Java  ,   ,  Python  , , React  ');
  assert.deepStrictEqual(result, ['Java', 'Python', 'React']);
});

runTest('normalizeSkills handles newline separators and mixed commas', () => {
  const result = normalizeSkills('Go\nRust,\nTypeScript\n  C++  ');
  assert.deepStrictEqual(result, ['Go', 'Rust', 'TypeScript', 'C++']);
});

runTest('normalizeSkills deduplicates case-insensitively while preserving original casing', () => {
  const result = normalizeSkills('Python, python, PYTHON, TypeScript, typescript');
  assert.deepStrictEqual(result, ['Python', 'TypeScript']);
});

runTest('formatSkillsForDisplay converts string array to clean comma-separated display string', () => {
  assert.strictEqual(formatSkillsForDisplay(['Java', 'Python', 'React']), 'Java, Python, React');
  assert.strictEqual(formatSkillsForDisplay([]), '');
  assert.strictEqual(formatSkillsForDisplay(null), '');
});

// 3. Validation Logic Tests
runTest('validateProfile accepts empty profile (all fields optional for partial profile)', () => {
  const empty = createEmptyProfile();
  const res = validateProfile(empty);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(Object.keys(res.errors).length, 0);
});

runTest('validateProfile accepts fully populated valid profile', () => {
  const profile = {
    personal: {
      fullName: 'Alex Morgan',
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'alex.morgan@example.com',
      phone: '+1 (555) 019-2834',
      location: 'Seattle, WA',
    },
    education: {
      college: 'University of Washington',
      degree: 'B.S.',
      branch: 'Computer Science',
      cgpa: '3.92',
      graduationYear: '2025',
    },
    online: {
      github: 'https://github.com/alexmorgan',
      linkedin: 'https://linkedin.com/in/alexmorgan',
      portfolio: 'https://alexmorgan.dev',
    },
    skills: ['TypeScript', 'React', 'Node.js'],
  };

  const res = validateProfile(profile);
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(Object.keys(res.errors).length, 0);
});

runTest('validateProfile rejects invalid email format', () => {
  const profile = createEmptyProfile();
  profile.personal.email = 'not-an-email';
  const res = validateProfile(profile);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors['personal.email']);
});

runTest('validateProfile rejects invalid phone numbers (< 7 digits)', () => {
  const profile = createEmptyProfile();
  profile.personal.phone = '123';
  const res = validateProfile(profile);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors['personal.phone']);
});

runTest('validateProfile rejects invalid CGPA range (<0 or >10 or non-numeric)', () => {
  const profileHigh = createEmptyProfile();
  profileHigh.education.cgpa = '11.5';
  assert.strictEqual(validateProfile(profileHigh).isValid, false);

  const profileNeg = createEmptyProfile();
  profileNeg.education.cgpa = '-0.5';
  assert.strictEqual(validateProfile(profileNeg).isValid, false);

  const profileText = createEmptyProfile();
  profileText.education.cgpa = 'abc';
  assert.strictEqual(validateProfile(profileText).isValid, false);

  const profileValid = createEmptyProfile();
  profileValid.education.cgpa = '9.85';
  assert.strictEqual(validateProfile(profileValid).isValid, true);
});

runTest('validateProfile rejects invalid graduation year (must be 4-digit 1950-2100)', () => {
  const profileOld = createEmptyProfile();
  profileOld.education.graduationYear = '1899';
  assert.strictEqual(validateProfile(profileOld).isValid, false);

  const profileFar = createEmptyProfile();
  profileFar.education.graduationYear = '2150';
  assert.strictEqual(validateProfile(profileFar).isValid, false);

  const profileShort = createEmptyProfile();
  profileShort.education.graduationYear = '25';
  assert.strictEqual(validateProfile(profileShort).isValid, false);

  const profileValid = createEmptyProfile();
  profileValid.education.graduationYear = '2026';
  assert.strictEqual(validateProfile(profileValid).isValid, true);
});

runTest('validateProfile validates URL formats for online profiles', () => {
  const profileInvalid = createEmptyProfile();
  profileInvalid.online.github = 'just-some-text';
  const resInv = validateProfile(profileInvalid);
  assert.strictEqual(resInv.isValid, false);
  assert.ok(resInv.errors['online.github']);

  const profileValid = createEmptyProfile();
  profileValid.online.github = 'https://github.com/developer';
  profileValid.online.linkedin = 'linkedin.com/in/developer';
  profileValid.online.portfolio = 'https://myportfolio.io';
  const resVal = validateProfile(profileValid);
  assert.strictEqual(resVal.isValid, true);
});

console.log('----------------------------------------------------');
console.log(`Results: ${passedTests} passed, ${failedTests} failed.`);
console.log('----------------------------------------------------');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL BEHAVIORAL TESTS PASSED!');
  process.exit(0);
}
