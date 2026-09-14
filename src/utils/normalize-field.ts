/**
 * Normalization utilities for form field attributes and text signals.
 */

/**
 * Normalizes text signals (name, id, label, placeholder, autocomplete, surrounding text):
 * - Separates camelCase and PascalCase into words
 * - Converts underscores and hyphens to spaces
 * - Collapses repeated whitespace
 * - Converts to lowercase and trims
 * 
 * Examples:
 * - "candidate_full_name" -> "candidate full name"
 * - "CandidateName" -> "candidate name"
 * - "EMAIL_ADDRESS" -> "email address"
 * - "  Phone-Number  " -> "phone number"
 */
export function normalizeFieldText(rawText: string | null | undefined): string {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  return rawText
    // 1. Separate camelCase and PascalCase (e.g. "firstName" -> "first Name", "XMLHttpRequest" -> "XML Http Request")
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // 2. Replace underscores, hyphens, and slashes with space
    .replace(/[_\-/]+/g, ' ')
    // 3. Collapse multiple whitespace characters into single space
    .replace(/\s+/g, ' ')
    // 4. Trim and convert to lowercase
    .trim()
    .toLowerCase();
}
