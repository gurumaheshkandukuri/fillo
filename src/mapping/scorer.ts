import type { FieldMetadata, ProfileFieldKey, ConfidenceLevel, CandidateMatch } from '../types/field.ts';
import type { SemanticFieldDefinition } from './field-schema.ts';
import { tokenize, matchPhrase, checkNegativeKeyword } from './matcher.ts';
import { normalizeFieldText } from '../utils/normalize-field.ts';

const WEIGHT_AUTOCOMPLETE = 35;
const WEIGHT_LABEL = 30;
const WEIGHT_NAME = 20;
const WEIGHT_ARIA = 20;
const WEIGHT_ID = 15;
const WEIGHT_PLACEHOLDER = 15;
const WEIGHT_SURROUNDING = 5;
const WEIGHT_TYPE = 10;

// Divisor to normalize raw score into 0.00 - 1.00 range
const NORMALIZATION_DIVISOR = 45;

export interface EvaluationDetail {
  candidate: CandidateMatch;
  rawScore: number;
}

/**
 * Evaluates a single semantic field candidate against the web field metadata.
 */
export function evaluateCandidate(
  fieldDef: SemanticFieldDefinition,
  metadata: FieldMetadata
): EvaluationDetail {
  let rawScore = 0;
  const reasons: string[] = [];
  const seenSignalTexts = new Set<string>();

  // 1. Negative Keyword Penalty Check across all available text signals
  const allTextSignals = [
    metadata.labelTextNormalized,
    metadata.nameNormalized,
    metadata.idNormalized,
    metadata.placeholderNormalized,
    metadata.ariaLabelNormalized,
    metadata.surroundingTextNormalized,
    metadata.autocompleteNormalized,
  ].filter(Boolean);

  let negativePenaltyApplied = false;

  for (const signal of allTextSignals) {
    const negTerm = checkNegativeKeyword(signal, fieldDef.negativeKeywords);
    if (negTerm) {
      rawScore -= 50;
      negativePenaltyApplied = true;
      reasons.push(`Negative term "${negTerm}" disfavors ${fieldDef.canonicalName} (-50 pts)`);
    }
  }

  // Helper to score a text signal against field synonyms
  const scoreTextSignal = (signalText: string, maxWeight: number, signalName: string) => {
    if (!signalText) return;

    // Detect duplicate token repetition across different attributes
    const isDuplicate = seenSignalTexts.has(signalText);
    seenSignalTexts.add(signalText);
    const weightMultiplier = isDuplicate ? 0.25 : 1.0;

    let bestMatchScore = 0;
    let matchedSynonym = '';

    for (const syn of fieldDef.synonyms) {
      const match = matchPhrase(signalText, syn);
      let matchScore = 0;

      if (match.isExact) {
        matchScore = maxWeight;
      } else if (match.isContained) {
        matchScore = maxWeight * 0.9;
      } else if (match.tokenOverlapRatio === 1.0) {
        matchScore = maxWeight * 0.85;
      } else if (match.tokenOverlapRatio >= 0.5) {
        matchScore = maxWeight * 0.5;
      }

      if (matchScore > bestMatchScore) {
        bestMatchScore = matchScore;
        matchedSynonym = syn;
      }
    }

    if (bestMatchScore > 0) {
      const awarded = bestMatchScore * weightMultiplier;
      rawScore += awarded;
      reasons.push(
        `${signalName} matched "${matchedSynonym}" (${awarded.toFixed(1)} pts${
          isDuplicate ? ' - duplicate discount' : ''
        })`
      );
    }
  };

  // 2. Autocomplete Signal
  if (metadata.autocompleteNormalized) {
    const autoNorm = metadata.autocompleteNormalized.trim();
    const matchedToken = fieldDef.autocompleteTokens.find(
      (t) => normalizeFieldText(t) === autoNorm || t.toLowerCase() === autoNorm
    );
    if (matchedToken) {
      rawScore += WEIGHT_AUTOCOMPLETE;
      reasons.push(`autocomplete matched "${matchedToken}" (${WEIGHT_AUTOCOMPLETE} pts)`);
    }
  }

  // 3. Label Text Signal (Highest text priority)
  scoreTextSignal(metadata.labelTextNormalized, WEIGHT_LABEL, 'label');

  // 4. ARIA Label Signal
  scoreTextSignal(metadata.ariaLabelNormalized, WEIGHT_ARIA, 'aria-label');

  // 5. Name Attribute Signal
  scoreTextSignal(metadata.nameNormalized, WEIGHT_NAME, 'name');

  // 6. ID Attribute Signal
  scoreTextSignal(metadata.idNormalized, WEIGHT_ID, 'id');

  // 7. Placeholder Signal
  scoreTextSignal(metadata.placeholderNormalized, WEIGHT_PLACEHOLDER, 'placeholder');

  // 8. Surrounding Text Signal
  scoreTextSignal(metadata.surroundingTextNormalized, WEIGHT_SURROUNDING, 'surrounding text');

  // 9. Input Type Compatibility Signal
  const inputType = metadata.type.toLowerCase().trim();
  if (fieldDef.compatibleInputTypes.includes(inputType)) {
    // If inputType is specialized (e.g. email, tel, url, number, textarea) give strong support
    const isSpecializedType = ['email', 'tel', 'url', 'number', 'textarea'].includes(inputType);
    const typeBonus = isSpecializedType ? WEIGHT_TYPE : WEIGHT_TYPE * 0.5;
    rawScore += typeBonus;
    reasons.push(`input type "${inputType}" is compatible with ${fieldDef.canonicalName}`);
  }

  // If score dropped to or below zero due to negative penalties
  if (rawScore <= 0) {
    return {
      candidate: {
        profileField: fieldDef.key,
        confidence: 0,
        confidenceLevel: 'low',
        reasons,
      },
      rawScore,
    };
  }

  // Normalize confidence into 0.00 - 1.00
  const normalizedConfidence = Math.min(1.0, Math.max(0.0, rawScore / NORMALIZATION_DIVISOR));
  const roundedConfidence = Math.round(normalizedConfidence * 100) / 100;

  // Determine Confidence Level
  let confidenceLevel: ConfidenceLevel = 'low';
  if (roundedConfidence >= 0.85) {
    confidenceLevel = 'high';
  } else if (roundedConfidence >= 0.65) {
    confidenceLevel = 'medium';
  }

  return {
    candidate: {
      profileField: fieldDef.key,
      confidence: roundedConfidence,
      confidenceLevel,
      reasons,
    },
    rawScore,
  };
}
