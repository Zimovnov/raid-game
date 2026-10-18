interface FocusMarker {
  element: HTMLElement | null;
  insideDialog: boolean;
  id: string;
  action: string;
  target: string;
}

const focusable = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function findReplacement(root: HTMLElement, marker: FocusMarker): HTMLElement | null {
  if (marker.element?.isConnected && root.contains(marker.element)) return marker.element;
  if (marker.id) {
    const byId = root.querySelectorAll<HTMLElement>('[id]');
    for (const element of byId) if (element.id === marker.id) return element;
  }
  if (marker.action) {
    for (const element of root.querySelectorAll<HTMLElement>('[data-act]')) {
      if (element.dataset.act === marker.action && element.dataset.id === marker.target) return element;
    }
  }
  return null;
}

export class DialogFocus {
  private open = false;
  private returnTo: FocusMarker | null = null;

  capture(): FocusMarker {
    const element = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return { element, insideDialog: !!element?.closest('.overlay'), id: element?.id || '', action: element?.dataset.act || '', target: element?.dataset.id || '' };
  }

  update(root: HTMLElement, before: FocusMarker) {
    const overlay = root.querySelector<HTMLElement>('.overlay');
    const dialog = overlay?.querySelector<HTMLElement>('section');
    if (!dialog) {
      if (this.open) {
        this.open = false;
        const target = this.returnTo && findReplacement(root, this.returnTo);
        (target || root.querySelector<HTMLElement>('button:not(:disabled)'))?.focus({ preventScroll: true });
        this.returnTo = null;
      }
      return;
    }
    if (!this.open) { this.open = true; this.returnTo = before.insideDialog ? null : before; }
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const title = dialog.querySelector<HTMLElement>('h1,h2,h3');
    if (title) { title.id ||= 'game-dialog-title'; dialog.setAttribute('aria-labelledby', title.id); }
    dialog.tabIndex = -1;
    if (dialog.contains(document.activeElement)) return;
    const replacement = before.insideDialog ? findReplacement(dialog, before) : null;
    (replacement || dialog.querySelector<HTMLElement>(focusable) || dialog).focus({ preventScroll: true });
  }

  trap(root: HTMLElement, event: KeyboardEvent): boolean {
    if (event.key !== 'Tab') return false;
    const dialog = root.querySelector<HTMLElement>('.overlay section');
    if (!dialog) return false;
    const elements = [...dialog.querySelectorAll<HTMLElement>(focusable)];
    if (!elements.length) { event.preventDefault(); dialog.focus(); return true; }
    const current = document.activeElement;
    if (!dialog.contains(current) || event.shiftKey && current === elements[0]) {
      event.preventDefault(); elements[event.shiftKey ? elements.length - 1 : 0].focus();
    } else if (!event.shiftKey && current === elements[elements.length - 1]) {
      event.preventDefault(); elements[0].focus();
    }
    return true;
  }
}
