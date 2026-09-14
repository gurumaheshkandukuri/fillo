/**
 * FILLO Autofill Types (Milestone 4: Safe Autofill Engine)
 * Strongly typed definitions for autofill status, safety decisions, and results.
 */

import type { ProfileFieldKey } from './field.ts';

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
