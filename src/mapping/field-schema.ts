import type { ProfileFieldKey } from '../types/field.ts';
import { FIELD_VOCABULARY } from './synonyms.ts';
import type { FieldVocabulary } from './synonyms.ts';

export interface SemanticFieldDefinition extends FieldVocabulary {}

/**
 * Returns all supported semantic field definitions in the system.
 */
export function getAllFieldDefinitions(): SemanticFieldDefinition[] {
  return Object.values(FIELD_VOCABULARY);
}

/**
 * Retrieves a specific semantic field definition by its key.
 */
export function getFieldDefinition(key: ProfileFieldKey): SemanticFieldDefinition | undefined {
  return FIELD_VOCABULARY[key];
}

/**
 * Checks whether an HTML input type is compatible with a given semantic field.
 */
export function isCompatibleInputType(key: ProfileFieldKey, inputType: string): boolean {
  const def = getFieldDefinition(key);
  if (!def) return false;

  const normalizedType = inputType.toLowerCase().trim();
  return def.compatibleInputTypes.includes(normalizedType);
}
