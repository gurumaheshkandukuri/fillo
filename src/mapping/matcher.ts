/**
 * Matcher & Token Analysis Utilities (Milestone 3B)
 * Deterministic tokenization, phrase matching, and negative keyword detection.
 */

/**
 * Splits normalized text into discrete word tokens.
 */
export function tokenize(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .split(/[\s_\-/.,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Checks if candidate text contains any negative / exclusion keyword as a whole word.
 * Returns the matched negative term, or null if none found.
 */
export function checkNegativeKeyword(
  text: string,
  negativeKeywords: string[]
): string | null {
  if (!text || negativeKeywords.length === 0) return null;

  const normalizedText = ` ${text.toLowerCase().trim()} `;
  const textTokens = new Set(tokenize(text));

  for (const neg of negativeKeywords) {
    const negClean = neg.toLowerCase().trim();
    if (negClean.includes(' ')) {
      // Multi-word negative term
      if (normalizedText.includes(` ${negClean} `)) {
        return negClean;
      }
    } else {
      // Single-word negative term
      if (textTokens.has(negClean)) {
        return negClean;
      }
    }
  }

  return null;
}

export interface PhraseMatchResult {
  isExact: boolean;
  isContained: boolean;
  tokenOverlapRatio: number;
  matchedTokens: string[];
}

/**
 * Compares an input signal (e.g. label or attribute name) against a synonym phrase.
 */
export function matchPhrase(signalText: string, synonym: string): PhraseMatchResult {
  const cleanSignal = signalText.toLowerCase().trim();
  const cleanSynonym = synonym.toLowerCase().trim();

  if (!cleanSignal || !cleanSynonym) {
    return { isExact: false, isContained: false, tokenOverlapRatio: 0, matchedTokens: [] };
  }

  // 1. Exact string match
  if (cleanSignal === cleanSynonym) {
    const tokens = tokenize(cleanSynonym);
    return {
      isExact: true,
      isContained: true,
      tokenOverlapRatio: 1.0,
      matchedTokens: tokens,
    };
  }

  // 2. Whole phrase containment (e.g. "enter your full name" contains "full name")
  const paddedSignal = ` ${cleanSignal} `;
  const paddedSynonym = ` ${cleanSynonym} `;
  const isContained = paddedSignal.includes(paddedSynonym);

  // 3. Token-based overlap
  const signalTokens = tokenize(cleanSignal);
  const synonymTokens = tokenize(cleanSynonym);
  const signalTokenSet = new Set(signalTokens);

  const matchedTokens = synonymTokens.filter((t) => signalTokenSet.has(t));
  const tokenOverlapRatio =
    synonymTokens.length > 0 ? matchedTokens.length / synonymTokens.length : 0;

  return {
    isExact: false,
    isContained,
    tokenOverlapRatio,
    matchedTokens,
  };
}
