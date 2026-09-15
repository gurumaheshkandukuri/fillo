/**
 * FILLO Autofill Safety Gate (Milestone 4: Safe Autofill Engine)
 * Conservative validation enforcing strict security, privacy, and correctness rules.
 */

import type { DetectedField, FieldMappingResult } from '../types/field.ts';
import type { Profile } from '../types/profile.ts';
import type { AutofillDecision } from '../types/autofill.ts';
import { getProfileValue } from './profile-value.ts';

/**
 * Checks whether a detected field and its semantic mapping can be safely autofilled.
 * Automatic filling is ONLY permitted when all conditions pass:
 * 1. Element exists and is inspectable
 * 2. Field is not disabled
 * 3. Field is not readonly
 * 4. Field is not a password input
 * 5. Field is not hidden
 * 6. Element type is supported (input[text-like], textarea, select)
 * 7. Mapping is unambiguous and HIGH confidence (>= 0.85)
 * 8. Profile value exists and is non-empty
 * 9. Field does not already contain user-entered value
 */
export function checkAutofillSafety(
  field: DetectedField,
  mapping: FieldMappingResult,
  profile: Profile
): AutofillDecision {
  // 1. Element existence & connection check
  if (!field || !field.element) {
    return { allowed: false, status: 'blocked', reason: 'element not found' };
  }

  const el = field.element;

  if (typeof el.isConnected === 'boolean' && !el.isConnected) {
    return { allowed: false, status: 'blocked', reason: 'disconnected element' };
  }

  if (Boolean((el as HTMLElement).isContentEditable)) {
    return { allowed: false, status: 'skipped', reason: 'unsupported element type' };
  }

  // 2. Disabled check
  const isDisabled =
    ('disabled' in el && Boolean((el as HTMLInputElement).disabled)) ||
    (typeof el.hasAttribute === 'function' && el.hasAttribute('disabled'));
  if (isDisabled) {
    return { allowed: false, status: 'skipped', reason: 'disabled field' };
  }

  // 3. Readonly check
  const isReadOnly =
    ('readOnly' in el && Boolean((el as HTMLInputElement).readOnly)) ||
    (typeof el.hasAttribute === 'function' && el.hasAttribute('readonly'));
  if (isReadOnly) {
    return { allowed: false, status: 'skipped', reason: 'readonly field' };
  }

  // 4. Password check
  const inputType = (
    (typeof el.getAttribute === 'function' && el.getAttribute('type')) ||
    (el as HTMLInputElement).type ||
    ''
  ).toLowerCase();

  if (inputType === 'password') {
    return { allowed: false, status: 'skipped', reason: 'password field' };
  }

  // 5. Hidden check
  const isHidden =
    inputType === 'hidden' ||
    Boolean((el as HTMLElement).hidden) ||
    (typeof el.getAttribute === 'function' && el.getAttribute('aria-hidden') === 'true');
  if (isHidden) {
    return { allowed: false, status: 'skipped', reason: 'hidden field' };
  }

  // 6. Supported element & input types check
  const tagName = (el.tagName || '').toLowerCase();
  if (tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') {
    return { allowed: false, status: 'skipped', reason: 'unsupported element type' };
  }

  if (tagName === 'input') {
    const supportedTypes = ['text', 'email', 'tel', 'url', 'number', 'search', ''];
    if (!supportedTypes.includes(inputType)) {
      return { allowed: false, status: 'skipped', reason: 'unsupported input type' };
    }
  }

  // 7. Mapping checks
  if (!mapping || !mapping.profileField) {
    return { allowed: false, status: 'skipped', reason: 'unmapped field' };
  }

  // Ambiguity check
  const hasAmbiguityReason =
    Array.isArray(mapping.reasons) &&
    mapping.reasons.some((r) => r.toLowerCase().includes('ambiguous'));
  const hasCompetingAlternative =
    Array.isArray(mapping.alternatives) &&
    mapping.alternatives.length > 0 &&
    mapping.confidence < 0.85 &&
    Math.abs(mapping.confidence - mapping.alternatives[0].confidence) <= 0.1;

  if (hasAmbiguityReason || hasCompetingAlternative) {
    return { allowed: false, status: 'skipped', reason: 'ambiguous mapping' };
  }

  // Confidence check
  if (mapping.confidenceLevel === 'medium' || (mapping.confidence >= 0.65 && mapping.confidence < 0.85)) {
    return { allowed: false, status: 'skipped', reason: 'medium confidence' };
  }

  if (mapping.confidenceLevel === 'low' || mapping.confidence < 0.65) {
    return { allowed: false, status: 'skipped', reason: 'low confidence' };
  }

  if (mapping.confidenceLevel !== 'high' || mapping.confidence < 0.85) {
    return { allowed: false, status: 'skipped', reason: 'insufficient confidence' };
  }

  // 8. Profile value check
  const profileValue = getProfileValue(profile, mapping.profileField);
  if (!profileValue) {
    return { allowed: false, status: 'skipped', reason: 'missing profile value' };
  }

  // 9. Existing user-entered value check (do not overwrite)
  if (tagName === 'input' || tagName === 'textarea') {
    const currentVal = (el as HTMLInputElement | HTMLTextAreaElement).value;
    if (typeof currentVal === 'string' && currentVal.trim().length > 0) {
      return { allowed: false, status: 'skipped', reason: 'existing user value' };
    }
  } else if (tagName === 'select') {
    const sel = el as HTMLSelectElement;
    if (typeof sel.value === 'string' && sel.value.trim().length > 0) {
      return { allowed: false, status: 'skipped', reason: 'existing user value' };
    }
  }

  // All safety checks passed
  return {
    allowed: true,
    status: 'filled',
    reason: 'eligible for autofill',
  };
}
