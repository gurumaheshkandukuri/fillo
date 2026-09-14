/**
 * FILLO Profile Value Resolver (Milestone 4: Safe Autofill Engine)
 * Pure, deterministic retrieval of profile values by ProfileFieldKey.
 */

import type { Profile } from '../types/profile.ts';
import type { ProfileFieldKey } from '../types/field.ts';

/**
 * Resolves a profile value from the user's Profile by its semantic ProfileFieldKey.
 * Returns null if the value is missing, empty, or undefined.
 */
export function getProfileValue(profile: Profile, key: ProfileFieldKey): string | null {
  if (!profile) {
    return null;
  }

  let value: string | undefined | null = null;

  switch (key) {
    case 'personal.fullName':
      value = profile.personal?.fullName;
      break;
    case 'personal.firstName':
      value = profile.personal?.firstName;
      break;
    case 'personal.lastName':
      value = profile.personal?.lastName;
      break;
    case 'personal.email':
      value = profile.personal?.email;
      break;
    case 'personal.phone':
      value = profile.personal?.phone;
      break;
    case 'personal.location':
      value = profile.personal?.location;
      break;
    case 'education.college':
      value = profile.education?.college;
      break;
    case 'education.degree':
      value = profile.education?.degree;
      break;
    case 'education.branch':
      value = profile.education?.branch;
      break;
    case 'education.cgpa':
      value = profile.education?.cgpa;
      break;
    case 'education.graduationYear':
      value = profile.education?.graduationYear;
      break;
    case 'online.github':
      value = profile.online?.github;
      break;
    case 'online.linkedin':
      value = profile.online?.linkedin;
      break;
    case 'online.portfolio':
      value = profile.online?.portfolio;
      break;
    case 'skills':
      if (Array.isArray(profile.skills) && profile.skills.length > 0) {
        value = profile.skills
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .join(', ');
      }
      break;
    default:
      value = null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
