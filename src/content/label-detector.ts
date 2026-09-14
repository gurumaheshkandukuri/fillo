/**
 * Label Discovery & Surrounding Text Detection (Milestone 3A)
 * Multi-signal extraction of labels and nearby context for form controls.
 */

function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Safely escapes an ID for use in querySelector.
 */
function escapeSelectorId(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(id);
  }
  return id.replace(/["'\\]/g, '\\$&');
}

/**
 * 1. Explicit <label for="element-id">
 */
export function findExplicitLabel(element: HTMLElement): string {
  const id = element.id ? element.id.trim() : '';
  if (!id) return '';

  const doc = element.ownerDocument;
  if (!doc) return '';

  try {
    const label = doc.querySelector(`label[for="${escapeSelectorId(id)}"]`);
    if (label && label.textContent) {
      return cleanText(label.textContent);
    }
  } catch {
    // If selector fails due to invalid ID characters, safe fallback
  }

  return '';
}

/**
 * 2. Wrapped <label> (<label>Text <input></label>)
 */
export function findWrappedLabel(element: HTMLElement): string {
  const labelParent = element.closest('label');
  if (!labelParent) return '';

  // Clone label to remove inputs/selects/textareas inside so we only get pure label text
  const clone = labelParent.cloneNode(true) as HTMLElement;
  const childControls = clone.querySelectorAll('input, select, textarea, button');
  childControls.forEach((ctrl) => ctrl.remove());

  return cleanText(clone.textContent);
}

/**
 * 3. aria-label attribute
 */
export function findAriaLabel(element: HTMLElement): string {
  return cleanText(element.getAttribute('aria-label'));
}

/**
 * 4. aria-labelledby attribute referencing element IDs
 */
export function findAriaLabelledBy(element: HTMLElement): string {
  const labelledBy = element.getAttribute('aria-labelledby');
  if (!labelledBy) return '';

  const doc = element.ownerDocument;
  if (!doc) return '';

  const idList = labelledBy.trim().split(/\s+/);
  const textParts: string[] = [];

  for (const refId of idList) {
    if (!refId) continue;
    try {
      const refEl = doc.getElementById(refId);
      if (refEl && refEl.textContent) {
        const cleaned = cleanText(refEl.textContent);
        if (cleaned) textParts.push(cleaned);
      }
    } catch {
      // Ignore invalid selector
    }
  }

  return textParts.join(' ');
}

/**
 * 5. Nearby / surrounding context
 * Extracts text from an immediate preceding sibling (e.g. <span>Label</span> <input>)
 * or immediate parent heading/span, strictly bounded to <= 120 chars.
 */
export function findSurroundingText(element: HTMLElement): string {
  // Check previous element sibling
  const prev = element.previousElementSibling;
  if (prev && prev.textContent) {
    const tagName = prev.tagName.toLowerCase();
    if (['span', 'label', 'p', 'div', 'b', 'strong', 'h4', 'h5', 'h6', 'legend'].includes(tagName)) {
      const cleaned = cleanText(prev.textContent);
      if (cleaned.length > 0 && cleaned.length <= 120) {
        return cleaned;
      }
    }
  }

  // Check immediate parent container's preceding text
  const parent = element.parentElement;
  if (parent && parent.tagName.toLowerCase() !== 'body') {
    // If parent has a legend (e.g. in fieldset)
    const legend = parent.querySelector('legend');
    if (legend && legend.textContent) {
      const cleaned = cleanText(legend.textContent);
      if (cleaned.length > 0 && cleaned.length <= 120) {
        return cleaned;
      }
    }

    // Direct preceding text node inside parent
    let prevNode = element.previousSibling;
    while (prevNode) {
      if (prevNode.nodeType === 3 /* Node.TEXT_NODE */ && prevNode.textContent) {
        const text = cleanText(prevNode.textContent);
        if (text.length > 0 && text.length <= 120) {
          return text;
        }
      } else if (prevNode.nodeType === 1 /* Node.ELEMENT_NODE */) {
        const el = prevNode as HTMLElement;
        if (['span', 'b', 'strong', 'label'].includes(el.tagName.toLowerCase()) && el.textContent) {
          const text = cleanText(el.textContent);
          if (text.length > 0 && text.length <= 120) {
            return text;
          }
        }
      }
      prevNode = prevNode.previousSibling;
    }
  }

  return '';
}

/**
 * Aggregates all label signals into a unified label text and individual signals.
 */
export function resolveLabelSignals(element: HTMLElement): {
  labelText: string;
  ariaLabel: string;
  ariaLabelledBy: string;
  surroundingText: string;
} {
  const explicit = findExplicitLabel(element);
  const wrapped = findWrappedLabel(element);
  const ariaLabel = findAriaLabel(element);
  const ariaLabelledByRef = element.getAttribute('aria-labelledby') || '';
  const ariaLabelledByText = findAriaLabelledBy(element);
  const surrounding = findSurroundingText(element);

  // Determine highest priority primary label:
  // 1. Explicit <label for>
  // 2. Wrapped <label>
  // 3. aria-labelledby text
  // 4. aria-label
  // 5. Nearby surrounding text
  let primaryLabel = '';
  if (explicit) {
    primaryLabel = explicit;
  } else if (wrapped) {
    primaryLabel = wrapped;
  } else if (ariaLabelledByText) {
    primaryLabel = ariaLabelledByText;
  } else if (ariaLabel) {
    primaryLabel = ariaLabel;
  } else if (surrounding) {
    primaryLabel = surrounding;
  }

  return {
    labelText: primaryLabel,
    ariaLabel,
    ariaLabelledBy: ariaLabelledByRef,
    surroundingText: surrounding,
  };
}
