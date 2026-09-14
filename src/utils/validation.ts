import type { Profile } from '../types/profile';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s\-().]{7,25}$/;

/**
 * Validates a web URL. Accepts http://, https://, or www. / domain formats.
 */
function isValidUrl(value: string): boolean {
  try {
    const urlToTest = value.startsWith('http://') || value.startsWith('https://') 
      ? value 
      : `https://${value}`;
    const parsed = new URL(urlToTest);
    return parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

/**
 * Validates a user profile. All fields are optional to support partial profiles,
 * but provided values are checked against sensible constraints.
 */
export function validateProfile(profile: Profile): ValidationResult {
  const errors: Record<string, string> = {};

  // Email validation
  if (profile.personal.email.trim()) {
    if (!EMAIL_REGEX.test(profile.personal.email.trim())) {
      errors['personal.email'] = 'Please enter a valid email address.';
    }
  }

  // Phone validation
  if (profile.personal.phone.trim()) {
    if (!PHONE_REGEX.test(profile.personal.phone.trim())) {
      errors['personal.phone'] = 'Please enter a valid phone number (at least 7 digits).';
    }
  }

  // CGPA validation
  if (profile.education.cgpa.trim()) {
    const cgpaVal = parseFloat(profile.education.cgpa.trim());
    if (isNaN(cgpaVal) || cgpaVal < 0 || cgpaVal > 10) {
      errors['education.cgpa'] = 'CGPA must be a number between 0.00 and 10.00.';
    }
  }

  // Graduation Year validation
  if (profile.education.graduationYear.trim()) {
    const yearVal = parseInt(profile.education.graduationYear.trim(), 10);
    const yearStr = profile.education.graduationYear.trim();
    if (isNaN(yearVal) || !/^\d{4}$/.test(yearStr) || yearVal < 1950 || yearVal > 2100) {
      errors['education.graduationYear'] = 'Graduation year must be a 4-digit year (e.g. 2025).';
    }
  }

  // Online profile URL validations
  if (profile.online.github.trim()) {
    if (!isValidUrl(profile.online.github.trim())) {
      errors['online.github'] = 'Please enter a valid GitHub URL or profile link.';
    }
  }

  if (profile.online.linkedin.trim()) {
    if (!isValidUrl(profile.online.linkedin.trim())) {
      errors['online.linkedin'] = 'Please enter a valid LinkedIn URL or profile link.';
    }
  }

  if (profile.online.portfolio.trim()) {
    if (!isValidUrl(profile.online.portfolio.trim())) {
      errors['online.portfolio'] = 'Please enter a valid portfolio URL.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
