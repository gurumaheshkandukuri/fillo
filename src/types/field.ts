/**
 * FILLO Field Representation Types (Milestone 3A & 3B)
 * Strongly typed representation of detected webpage form controls and semantic mappings.
 */

/**
 * Supported semantic profile fields that FILLO can map webpage controls to.
 */
export type ProfileFieldKey =
  | 'personal.fullName'
  | 'personal.firstName'
  | 'personal.lastName'
  | 'personal.email'
  | 'personal.phone'
  | 'personal.location'
  | 'education.college'
  | 'education.degree'
  | 'education.branch'
  | 'education.cgpa'
  | 'education.graduationYear'
  | 'online.github'
  | 'online.linkedin'
  | 'online.portfolio'
  | 'skills';

/**
 * Normalized confidence levels.
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Serializable metadata extracted from a form control.
 * Free from DOM element references, safe for messaging and logging.
 */
export interface FieldMetadata {
  tagName: 'input' | 'textarea' | 'select';
  type: string;
  name: string;
  nameNormalized: string;
  id: string;
  idNormalized: string;
  placeholder: string;
  placeholderNormalized: string;
  ariaLabel: string;
  ariaLabelNormalized: string;
  ariaLabelledBy: string;
  autocomplete: string;
  autocompleteNormalized: string;
  labelText: string;
  labelTextNormalized: string;
  surroundingText: string;
  surroundingTextNormalized: string;
}

/**
 * Live detected field containing the runtime DOM element alongside its metadata.
 */
export interface DetectedField {
  element: HTMLElement;
  metadata: FieldMetadata;
}

/**
 * An individual candidate field evaluation.
 */
export interface CandidateMatch {
  profileField: ProfileFieldKey;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  reasons: string[];
}

/**
 * Final result of mapping a web field to a profile field.
 */
export interface FieldMappingResult {
  profileField: ProfileFieldKey | null;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  reasons: string[];
  alternatives: CandidateMatch[];
}
