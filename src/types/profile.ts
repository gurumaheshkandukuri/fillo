/**
 * FILLO Profile Data Model
 * Centralized, strongly typed representation of a user's locally stored profile.
 */

export interface PersonalInfo {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
}

export interface EducationInfo {
  college: string;
  degree: string;
  branch: string;
  cgpa: string;
  graduationYear: string;
}

export interface OnlineProfiles {
  github: string;
  linkedin: string;
  portfolio: string;
}

export interface Profile {
  personal: PersonalInfo;
  education: EducationInfo;
  online: OnlineProfiles;
  skills: string[];
}

/**
 * Generates an empty Profile with default initialized fields.
 */
export function createEmptyProfile(): Profile {
  return {
    personal: {
      fullName: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      location: '',
    },
    education: {
      college: '',
      degree: '',
      branch: '',
      cgpa: '',
      graduationYear: '',
    },
    online: {
      github: '',
      linkedin: '',
      portfolio: '',
    },
    skills: [],
  };
}
