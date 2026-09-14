import { Profile } from '../types/profile';

/**
 * Dedicated local storage key for FILLO profile data.
 */
export const STORAGE_KEY = 'filloProfile';

/**
 * Saves the given Profile object to chrome.storage.local.
 * Strictly avoids logging personal data for privacy.
 */
export async function saveProfile(profile: Profile): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        throw new Error('Chrome storage API is not available.');
      }

      chrome.storage.local.set({ [STORAGE_KEY]: profile }, () => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        // Safe logging only: Never log profile details
        console.log('[FILLO] Profile saved successfully to local storage.');
        resolve();
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to save profile.'));
    }
  });
}

/**
 * Retrieves the saved Profile object from chrome.storage.local.
 * Returns null if no profile has been saved yet.
 */
export async function getProfile(): Promise<Profile | null> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        throw new Error('Chrome storage API is not available.');
      }

      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }

        const data = result[STORAGE_KEY];
        if (!data || typeof data !== 'object') {
          return resolve(null);
        }

        // Return typed profile
        resolve(data as Profile);
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to retrieve profile.'));
    }
  });
}

/**
 * Removes the saved Profile object from chrome.storage.local.
 */
export async function clearProfile(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        throw new Error('Chrome storage API is not available.');
      }

      chrome.storage.local.remove([STORAGE_KEY], () => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        console.log('[FILLO] Profile cleared successfully from local storage.');
        resolve();
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to clear profile.'));
    }
  });
}
