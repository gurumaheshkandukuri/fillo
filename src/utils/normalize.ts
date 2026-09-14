/**
 * Normalization utilities for profile fields.
 */

/**
 * Normalizes a raw skills string into a clean, deduplicated array of skill strings.
 * Supports comma-separated and newline-separated inputs.
 * 
 * Example:
 * "Java, Python,  , react, Python " -> ["Java", "Python", "react"]
 */
export function normalizeSkills(rawInput: string | undefined | null): string[] {
  if (!rawInput || typeof rawInput !== 'string') {
    return [];
  }

  const items = rawInput
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of items) {
    const lower = item.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      normalized.push(item);
    }
  }

  return normalized;
}

/**
 * Formats a skills array into a comma-separated string for display in UI form inputs.
 */
export function formatSkillsForDisplay(skills: string[] | undefined | null): string {
  if (!Array.isArray(skills) || skills.length === 0) {
    return '';
  }
  return skills.join(', ');
}
