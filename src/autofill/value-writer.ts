/**
 * FILLO Value Writer (Milestone 4: Safe Autofill Engine)
 * Safely writes resolved profile values into DOM controls and dispatches bubbling events.
 * Strictly avoids form submission, button clicking, or page navigation.
 */

const SUPPORTED_INPUT_TYPES = new Set(['text', 'email', 'tel', 'url', 'number', 'search', '']);

/**
 * Safely assigns a string value to an HTML input or textarea element.
 * Triggers bubbling 'input' and 'change' events for modern framework compatibility (React/Vue/Angular).
 */
export function writeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): boolean {
  if (!element) {
    return false;
  }

  // Reject disabled or readonly
  if (element.disabled || element.readOnly) {
    return false;
  }

  const tagName = (element.tagName || '').toLowerCase();
  const inputType = (element.type || '').toLowerCase();

  // Reject password and hidden
  if (inputType === 'password' || inputType === 'hidden' || element.hidden) {
    return false;
  }

  // Reject unsupported input types
  if (tagName === 'input' && !SUPPORTED_INPUT_TYPES.has(inputType)) {
    return false;
  }

  // Never overwrite existing user-entered values
  if (typeof element.value === 'string' && element.value.trim().length > 0) {
    return false;
  }

  try {
    // Framework-compatible value assignment (supports React 16+ controlled input tracker)
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor && typeof descriptor.set === 'function') {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    // Ensure value is set
    if (element.value !== value) {
      element.value = value;
    }

    // Dispatch bubbling events
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    return true;
  } catch {
    return false;
  }
}

/**
 * Safely selects an option on an HTMLSelectElement by matching against option text or value.
 * Uses exact normalized (lowercase, trimmed) comparison.
 * Never guesses or selects arbitrary options if no exact match is found.
 */
export function writeSelectValue(
  element: HTMLSelectElement,
  value: string
): boolean {
  if (!element || element.disabled) {
    return false;
  }

  // Never overwrite an already selected non-empty value
  if (typeof element.value === 'string' && element.value.trim().length > 0) {
    return false;
  }

  const normalizedTarget = value.trim().toLowerCase();
  if (normalizedTarget.length === 0) {
    return false;
  }

  // Exact normalized string helper (handles whitespace, hyphen, and underscore differences)
  const collapseDelimiters = (s: string) => s.toLowerCase().trim().replace(/[\s\-_]+/g, ' ');
  const collapsedTarget = collapseDelimiters(normalizedTarget);

  const options = element.options;
  if (!options || options.length === 0) {
    return false;
  }

  let matchedIndex = -1;

  // Pass 1: Strict exact match on text or value
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const optText = (opt.text || opt.textContent || '').trim().toLowerCase();
    const optValue = (opt.value || '').trim().toLowerCase();

    if (optText === normalizedTarget || optValue === normalizedTarget) {
      matchedIndex = i;
      break;
    }
  }

  // Pass 2: Exact match with collapsed whitespace/hyphen/underscore delimiters
  if (matchedIndex === -1) {
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const optText = collapseDelimiters(opt.text || opt.textContent || '');
      const optValue = collapseDelimiters(opt.value || '');

      if (optText === collapsedTarget || optValue === collapsedTarget) {
        matchedIndex = i;
        break;
      }
    }
  }

  if (matchedIndex === -1) {
    // No safe exact or delimiter-normalized match found -> skip
    return false;
  }

  try {
    element.selectedIndex = matchedIndex;
    if (options[matchedIndex]) {
      options[matchedIndex].selected = true;
    }

    // Dispatch bubbling events
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    return true;
  } catch {
    return false;
  }
}
