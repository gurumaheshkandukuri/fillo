/**
 * FILLO Autofill Controller (Milestone 5: Real-World Form Compatibility & Autofill UX)
 * Orchestrator layer bridging detected page fields, safety evaluations, user trigger actions,
 * and the autofill engine.
 *
 * Strictly adheres to safety, privacy, and architectural guidelines:
 * - Reuses checkAutofillSafety() without duplicating safety logic.
 * - Reuses mapField() without duplicating semantic rules.
 * - Does NOT modify DOM until executeAutofill() is explicitly called by the user.
 * - Never returns or leaks profile values in summaries.
 */

import type { DetectedField, FieldMappingResult } from '../types/field.ts';
import type { Profile } from '../types/profile.ts';
import type {
  AutofillStatusSummary,
  AutofillExecutionSummary,
  AutofillDecision,
} from '../types/autofill.ts';
import { FieldDetector } from '../content/field-detector.ts';
import { mapField } from '../mapping/mapper.ts';
import { checkAutofillSafety } from './safety-gate.ts';
import { AutofillEngine, defaultAutofillEngine } from './autofill-engine.ts';

export interface EvaluatedField {
  field: DetectedField;
  mapping: FieldMappingResult;
  decision: AutofillDecision;
}

export class AutofillController {
  private detector: FieldDetector;
  private engine: AutofillEngine;

  constructor(detector?: FieldDetector, engine?: AutofillEngine) {
    this.detector = detector || new FieldDetector();
    this.engine = engine || defaultAutofillEngine;
  }

  /**
   * Scans and evaluates current form controls against the profile.
   * Evaluates DOM state (disabled, readonly, existing value, etc.) via checkAutofillSafety()
   * without modifying any DOM values.
   */
  public getStatus(profile: Profile | null, explicitFields?: DetectedField[]): AutofillStatusSummary {
    const rawFields = explicitFields || this.detector.scan();
    const fields = rawFields.filter(
      (f) => f.element && (typeof f.element.isConnected !== 'boolean' || f.element.isConnected)
    );
    const evaluated: EvaluatedField[] = [];

    for (const field of fields) {
      const mapping = mapField(field.metadata);
      let decision: AutofillDecision;

      if (!profile) {
        decision = {
          allowed: false,
          status: 'skipped',
          reason: 'profile not set up',
        };
      } else {
        // Reuse checkAutofillSafety directly — no duplication of safety rules
        decision = checkAutofillSafety(field, mapping, profile);

        // If field was already autofilled in this session, reflect that in decision
        if (decision.allowed && this.engine.isAlreadyFilled(field.element)) {
          decision = {
            allowed: false,
            status: 'skipped',
            reason: 'already autofilled',
          };
        }
      }

      evaluated.push({ field, mapping, decision });
    }

    const eligibleCount = evaluated.filter((e) => e.decision.allowed).length;

    return {
      detectedCount: fields.length,
      eligibleCount,
      ready: eligibleCount > 0 && profile !== null,
      profileReady: profile !== null,
      fieldSummaries: evaluated.map((e) => ({
        profileField: e.mapping.profileField,
        confidenceLevel: e.mapping.confidenceLevel,
        allowed: e.decision.allowed,
        reason: e.decision.reason,
      })),
    };
  }

  /**
   * Executes autofill ONLY upon explicit user action ("Fill with FILLO").
   * Fills only safe, high-confidence, empty, un-filled fields.
   * Returns a sanitized summary with counts and skip reasons (zero profile values).
   */
  public executeAutofill(
    profile: Profile | null,
    explicitFields?: DetectedField[]
  ): AutofillExecutionSummary {
    const rawFields = explicitFields || this.detector.scan();
    const fields = rawFields.filter(
      (f) => f.element && (typeof f.element.isConnected !== 'boolean' || f.element.isConnected)
    );

    if (!profile) {
      return {
        detected: fields.length,
        eligible: 0,
        filled: 0,
        skipped: fields.length,
        skippedReasons: [
          {
            labelOrField: 'Profile',
            reason: 'profile not set up',
          },
        ],
      };
    }

    let eligibleCount = 0;
    let filledCount = 0;
    let skippedCount = 0;
    const skippedReasons: Array<{ labelOrField: string; reason: string }> = [];

    for (const field of fields) {
      const mapping = mapField(field.metadata);

      const fieldLabel =
        field.metadata.labelText ||
        field.metadata.placeholder ||
        field.metadata.name ||
        field.metadata.id ||
        (mapping.profileField ? String(mapping.profileField) : 'Field');

      // Check if already filled in this session first (preserves 'already autofilled' reason)
      if (this.engine.isAlreadyFilled(field.element)) {
        skippedCount++;
        skippedReasons.push({
          labelOrField: fieldLabel,
          reason: 'already autofilled',
        });
        continue;
      }

      const decision = checkAutofillSafety(field, mapping, profile);

      if (!decision.allowed) {
        skippedCount++;
        skippedReasons.push({
          labelOrField: fieldLabel,
          reason: decision.reason,
        });
        continue;
      }

      eligibleCount++;

      // Delegate directly to the M4 autofill engine
      const result = this.engine.autofillField(field, mapping, profile);

      if (result.status === 'filled') {
        filledCount++;
        // Safe logging only: strictly zero personal data
        console.log(`[FILLO] Autofilled: ${result.profileField} (high confidence)`);
      } else {
        skippedCount++;
        skippedReasons.push({
          labelOrField: fieldLabel,
          reason: result.reason,
        });
        console.log(`[FILLO] Skipped field: ${result.reason}`);
      }
    }

    return {
      detected: fields.length,
      eligible: eligibleCount,
      filled: filledCount,
      skipped: skippedCount,
      skippedReasons,
    };
  }
}
