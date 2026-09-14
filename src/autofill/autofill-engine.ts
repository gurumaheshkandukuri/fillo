/**
 * FILLO Autofill Engine Orchestrator (Milestone 4: Safe Autofill Engine)
 * Coordinates safety decisions, profile value extraction, and safe DOM value assignment.
 */

import type { DetectedField, FieldMappingResult } from '../types/field.ts';
import type { Profile } from '../types/profile.ts';
import type { AutofillResult } from '../types/autofill.ts';
import { checkAutofillSafety } from './safety-gate.ts';
import { getProfileValue } from './profile-value.ts';
import { writeInputValue, writeSelectValue } from './value-writer.ts';

export class AutofillEngine {
  private filledElements: WeakSet<Element>;

  constructor() {
    this.filledElements = new WeakSet<Element>();
  }

  /**
   * Checks if an element has already been successfully filled in this session.
   */
  public isAlreadyFilled(element: Element): boolean {
    return this.filledElements.has(element);
  }

  /**
   * Evaluates and safely autofills a single detected field.
   */
  public autofillField(
    field: DetectedField,
    mapping: FieldMappingResult,
    profile: Profile
  ): AutofillResult {
    const profileField = mapping ? mapping.profileField : null;

    if (!field || !field.element) {
      return {
        profileField,
        status: 'blocked',
        reason: 'element not found',
      };
    }

    // 1. Prevent duplicate autofill attempts on already-filled elements
    if (this.filledElements.has(field.element)) {
      return {
        profileField,
        status: 'skipped',
        reason: 'already autofilled',
      };
    }

    // 2. Safety Gate evaluation
    const decision = checkAutofillSafety(field, mapping, profile);
    if (!decision.allowed) {
      return {
        profileField,
        status: decision.status,
        reason: decision.reason,
      };
    }

    // 3. Resolve profile value
    const resolvedValue = getProfileValue(profile, mapping.profileField!);
    if (!resolvedValue) {
      return {
        profileField,
        status: 'skipped',
        reason: 'missing profile value',
      };
    }

    // 4. Safe DOM value writing
    const el = field.element;
    const tagName = (el.tagName || '').toLowerCase();
    let writeSuccess = false;

    if (tagName === 'select') {
      writeSuccess = writeSelectValue(el as HTMLSelectElement, resolvedValue);
    } else if (tagName === 'input' || tagName === 'textarea') {
      writeSuccess = writeInputValue(el as HTMLInputElement | HTMLTextAreaElement, resolvedValue);
    }

    if (!writeSuccess) {
      return {
        profileField,
        status: 'skipped',
        reason: 'value rejected or no matching select option',
      };
    }

    // 5. Track element to avoid re-filling during dynamic scans
    this.filledElements.add(el);

    return {
      profileField,
      status: 'filled',
      reason: 'autofilled successfully',
    };
  }

  /**
   * Resets the filled elements registry (useful for testing).
   */
  public reset(): void {
    this.filledElements = new WeakSet<Element>();
  }
}

/**
 * Shared singleton autofill engine instance.
 */
export const defaultAutofillEngine = new AutofillEngine();

/**
 * Convenience helper function matching functional autofill API.
 */
export function autofillField(
  field: DetectedField,
  mapping: FieldMappingResult,
  profile: Profile
): AutofillResult {
  return defaultAutofillEngine.autofillField(field, mapping, profile);
}
