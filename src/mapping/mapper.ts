import type { FieldMetadata, FieldMappingResult, CandidateMatch } from '../types/field.ts';
import { getAllFieldDefinitions } from './field-schema.ts';
import { evaluateCandidate } from './scorer.ts';
import { tokenize } from './matcher.ts';

/**
 * Maps a single FieldMetadata into the most likely FILLO profile field.
 * Pure function: No DOM access, no storage access, no external APIs.
 */
export function mapField(metadata: FieldMetadata): FieldMappingResult {
  const definitions = getAllFieldDefinitions();
  const candidateResults: CandidateMatch[] = [];

  for (const def of definitions) {
    const evaluation = evaluateCandidate(def, metadata);
    if (evaluation.rawScore > 0 && evaluation.candidate.confidence > 0) {
      candidateResults.push(evaluation.candidate);
    }
  }

  // If no candidates matched with positive score
  if (candidateResults.length === 0) {
    return {
      profileField: null,
      confidence: 0,
      confidenceLevel: 'low',
      reasons: ['No matching profile field vocabulary found'],
      alternatives: [],
    };
  }

  // Sort candidates by confidence descending
  candidateResults.sort((a, b) => b.confidence - a.confidence);

  let topCandidate = candidateResults[0];
  const alternatives = candidateResults.slice(1);

  // Check for Ambiguity:
  // 1. Generic "Name" token without explicit qualifier (full, first, last, given, family)
  const labelTokens = tokenize(metadata.labelTextNormalized);
  const nameTokens = tokenize(metadata.nameNormalized);
  const combinedTokens = new Set([...labelTokens, ...nameTokens]);

  const isGenericName =
    combinedTokens.has('name') &&
    !combinedTokens.has('full') &&
    !combinedTokens.has('fullname') &&
    !combinedTokens.has('first') &&
    !combinedTokens.has('given') &&
    !combinedTokens.has('last') &&
    !combinedTokens.has('family') &&
    !combinedTokens.has('surname') &&
    !combinedTokens.has('candidate') &&
    !combinedTokens.has('applicant') &&
    !metadata.autocompleteNormalized;

  // 2. Score closeness between top two candidates
  const isScoreAmbiguous =
    alternatives.length > 0 &&
    topCandidate.confidence < 0.85 &&
    Math.abs(topCandidate.confidence - alternatives[0].confidence) <= 0.1;

  if (isGenericName || isScoreAmbiguous) {
    // Flag ambiguity, cap confidence at low range, add explanation
    const cappedConfidence = Math.min(topCandidate.confidence, 0.58);
    topCandidate = {
      ...topCandidate,
      confidence: cappedConfidence,
      confidenceLevel: 'low',
      reasons: [
        'Ambiguous: generic identifier could refer to multiple profile fields (e.g. full, first, or last name)',
        ...topCandidate.reasons,
      ],
    };
  }

  return {
    profileField: topCandidate.profileField,
    confidence: topCandidate.confidence,
    confidenceLevel: topCandidate.confidenceLevel,
    reasons: topCandidate.reasons,
    alternatives,
  };
}
