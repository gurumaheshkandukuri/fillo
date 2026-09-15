import { FieldDetector } from './field-detector.ts';
import type { DetectedField } from '../types/field.ts';

/**
 * DynamicFormObserver
 * Observes DOM mutations with debouncing to detect newly added form fields
 * without causing performance overhead or infinite scan loops.
 */
export class DynamicFormObserver {
  private detector: FieldDetector;
  private onFieldsAdded?: (newFields: DetectedField[]) => void;
  private observer: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs = 150;

  constructor(
    detector: FieldDetector,
    onFieldsAdded?: (newFields: DetectedField[]) => void
  ) {
    this.detector = detector;
    this.onFieldsAdded = onFieldsAdded;
  }

  /**
   * Starts observing the specified target node (defaults to document.body).
   */
  public start(target: Node = document.body): void {
    if (this.observer || !target) {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      let containsCandidate = false;

      for (const mutation of mutations) {
        // Handle added nodes
        if (mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
              const el = node as HTMLElement;
              const tag = el.tagName.toLowerCase();
              if (
                tag === 'input' ||
                tag === 'textarea' ||
                tag === 'select' ||
                el.querySelector?.('input, textarea, select')
              ) {
                containsCandidate = true;
                break;
              }
            }
          }
        }

        // Handle removed nodes
        if (mutation.removedNodes.length > 0) {
          for (let i = 0; i < mutation.removedNodes.length; i++) {
            const node = mutation.removedNodes[i];
            if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
              const el = node as HTMLElement;
              const tag = el.tagName.toLowerCase();
              if (
                tag === 'input' ||
                tag === 'textarea' ||
                tag === 'select' ||
                el.querySelector?.('input, textarea, select')
              ) {
                this.detector.pruneStaleFields();
                break;
              }
            }
          }
        }

        if (containsCandidate) break;
      }

      // If added nodes contain potential form controls, schedule a debounced scan
      if (containsCandidate) {
        this.scheduleScan();
      }
    });

    this.observer.observe(target, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Stops the mutation observer and clears pending timers.
   */
  public stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private scheduleScan(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      const newFields = this.detector.scan();
      if (newFields.length > 0 && this.onFieldsAdded) {
        this.onFieldsAdded(newFields);
      }
    }, this.debounceMs);
  }
}
