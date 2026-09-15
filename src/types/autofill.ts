/**
 * FILLO Autofill Types (Milestones 4 & 5: Safe Autofill Engine & Controller)
 * Strongly typed definitions for autofill status, safety decisions, results, and controller summaries.
 */

import type { ProfileFieldKey, ConfidenceLevel } from './field.ts';

export type AutofillStatus =
  | 'filled'
  | 'skipped'
  | 'blocked'
  | 'failed';

export interface AutofillDecision {
  allowed: boolean;
  status: AutofillStatus;
  reason: string;
}

export interface AutofillResult {
  profileField: ProfileFieldKey | null;
  status: AutofillStatus;
  reason: string;
}

/**
 * High-level status summary for popup UI and controller status queries.
 * Contains only counts and metadata — strictly zero personal profile values.
 */
export interface AutofillStatusSummary {
  detectedCount: number;
  eligibleCount: number;
  ready: boolean;
  profileReady: boolean;
  fieldSummaries: Array<{
    profileField: ProfileFieldKey | null;
    confidenceLevel: ConfidenceLevel;
    allowed: boolean;
    reason: string;
  }>;
}

/**
 * Execution summary returned after user-triggered autofill.
 * Contains only counts, field labels/keys, and skip reasons — strictly zero personal values.
 */
export interface AutofillExecutionSummary {
  detected: number;
  eligible: number;
  filled: number;
  skipped: number;
  skippedReasons: Array<{
    labelOrField: string;
    reason: string;
  }>;
}

/**
 * Popup <-> Content Script Message Protocol
 */
export type AutofillMessage =
  | { type: 'GET_AUTOFILL_STATUS' }
  | { type: 'EXECUTE_AUTOFILL' };
