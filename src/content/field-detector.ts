import type { DetectedField, FieldMetadata } from '../types/field.ts';
import { resolveLabelSignals } from './label-detector.ts';
import { normalizeFieldText } from '../utils/normalize-field.ts';

/**
 * Disallowed input types that should never be inspected or autofilled.
 */
const IGNORED_INPUT_TYPES = new Set([
  'hidden',
  'password',
  'submit',
  'reset',
  'button',
  'image',
  'file',
]);

/**
 * FieldDetector
 * Responsible for discovering, filtering, and extracting metadata from form controls.
 * Operates in strict read-only mode (never writes values, never dispatches events).
 */
export class FieldDetector {
  private seenElements = new WeakSet<Element>();
  private trackedFields: DetectedField[] = [];

  /**
   * Determines if a DOM element is an active, inspectable form control.
   */
  public isInspectable(element: HTMLElement): boolean {
    if (!element || !element.tagName) {
      return false;
    }

    const tagName = element.tagName.toLowerCase();
    if (tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') {
      return false;
    }

    // Check disabled status (property and attributes)
    if ((element as HTMLInputElement).disabled) {
      return false;
    }
    if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
      return false;
    }

    // Check input type restrictions
    if (tagName === 'input') {
      const inputType = (element.getAttribute('type') || 'text').toLowerCase().trim();
      if (IGNORED_INPUT_TYPES.has(inputType)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extracts metadata from a single DOM element without modifying it.
   * Returns null if the element is already tracked or not inspectable.
   */
  public extractField(element: HTMLElement): DetectedField | null {
    if (!this.isInspectable(element)) {
      return null;
    }

    if (this.seenElements.has(element)) {
      return null;
    }

    this.seenElements.add(element);

    const tagName = element.tagName.toLowerCase() as 'input' | 'textarea' | 'select';
    let type = 'text';

    if (tagName === 'input') {
      type = (element.getAttribute('type') || 'text').toLowerCase().trim();
    } else if (tagName === 'textarea') {
      type = 'textarea';
    } else if (tagName === 'select') {
      type = 'select';
    }

    const name = element.getAttribute('name') || '';
    const id = element.id || '';
    const placeholder = element.getAttribute('placeholder') || '';
    const autocomplete = element.getAttribute('autocomplete') || '';

    // Extract multi-signal labels and surrounding context
    const labelSignals = resolveLabelSignals(element);

    const metadata: FieldMetadata = {
      tagName,
      type,
      name,
      nameNormalized: normalizeFieldText(name),
      id,
      idNormalized: normalizeFieldText(id),
      placeholder,
      placeholderNormalized: normalizeFieldText(placeholder),
      ariaLabel: labelSignals.ariaLabel,
      ariaLabelNormalized: normalizeFieldText(labelSignals.ariaLabel),
      ariaLabelledBy: labelSignals.ariaLabelledBy,
      autocomplete,
      autocompleteNormalized: normalizeFieldText(autocomplete),
      labelText: labelSignals.labelText,
      labelTextNormalized: normalizeFieldText(labelSignals.labelText),
      surroundingText: labelSignals.surroundingText,
      surroundingTextNormalized: normalizeFieldText(labelSignals.surroundingText),
    };

    const detectedField: DetectedField = {
      element,
      metadata,
    };

    this.trackedFields.push(detectedField);
    return detectedField;
  }

  /**
   * Scans a container or document for all inspectable form controls.
   * Returns an array of newly detected fields.
   */
  public scan(root: Document | HTMLElement = document): DetectedField[] {
    const candidates = root.querySelectorAll('input, textarea, select');
    const newFields: DetectedField[] = [];

    candidates.forEach((el) => {
      const field = this.extractField(el as HTMLElement);
      if (field) {
        newFields.push(field);
      }
    });

    return newFields;
  }

  /**
   * Returns all fields detected across scans.
   */
  public getDetectedFields(): DetectedField[] {
    return this.trackedFields;
  }

  /**
   * Resets tracked fields.
   */
  public clear(): void {
    this.trackedFields = [];
    this.seenElements = new WeakSet<Element>();
  }
}
