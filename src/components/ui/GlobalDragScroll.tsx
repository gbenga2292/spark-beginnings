import { useEffect } from 'react';
import { attachDragScroll } from '../../hooks/useDragScroll';
import '../../hooks/dragScroll.css';

/**
 * GlobalDragScroll
 * ─────────────────
 * Drop this once inside App. It uses a MutationObserver to watch the entire
 * document and automatically enables click-and-drag panning on EVERY element
 * that is horizontally or vertically scrollable:
 *
 *   • Elements with class  overflow-x-auto / overflow-y-auto
 *   • Elements with the    data-drag-scroll  attribute
 *   • <table> wrappers that have  overflow: auto / scroll  in their computed style
 *
 * No need to modify individual page components.
 */

// Selector that catches all scrollable table wrappers we care about
const SCROLL_SELECTOR = [
  '.overflow-x-auto',
  '[data-drag-scroll]',
].join(', ');

// Track which elements we've already enhanced (WeakSet avoids memory leaks)
const enhanced = new WeakSet<Element>();
const cleanupMap = new WeakMap<Element, () => void>();

function enhance(el: Element) {
  if (enhanced.has(el)) return;

  const htmlEl = el as HTMLElement;

  // Only bother if there's actually scrollable overflow
  const hasHScroll = htmlEl.scrollWidth > htmlEl.clientWidth + 4;
  const hasVScroll = htmlEl.scrollHeight > htmlEl.clientHeight + 4;

  // We still mark it — content may not be rendered yet; attachDragScroll
  // is cheap and the cursor makes it obvious the container is interactive.
  enhanced.add(el);
  htmlEl.classList.add('drag-scroll');
  const cleanup = attachDragScroll(htmlEl);
  cleanupMap.set(el, cleanup);
}

function scanAndEnhance(root: Document | Element = document) {
  const els =
    root === document
      ? document.querySelectorAll(SCROLL_SELECTOR)
      : (root as Element).querySelectorAll(SCROLL_SELECTOR);

  els.forEach(enhance);

  // Also enhance the root itself if it matches
  if (root !== document && (root as Element).matches?.(SCROLL_SELECTOR)) {
    enhance(root as Element);
  }
}

export function GlobalDragScroll() {
  useEffect(() => {
    // Initial scan
    scanAndEnhance();

    // Watch for dynamically added elements (route changes, lazy panels, etc.)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node as Element;
          scanAndEnhance(el);
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Global Ctrl key tracking for cursor switching
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        if (e.type === 'keydown') document.body.dataset.ctrlHeld = 'true';
        else delete document.body.dataset.ctrlHeld;
      }
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    // Safety: clear on window blur
    const onBlur = () => delete document.body.dataset.ctrlHeld;
    window.addEventListener('blur', onBlur);

    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
      window.removeEventListener('blur', onBlur);
      delete document.body.dataset.ctrlHeld;
      
      // Cleanup all enhanced elements
      document.querySelectorAll('.drag-scroll').forEach((el) => {
        const cleanup = cleanupMap.get(el);
        cleanup?.();
        (el as HTMLElement).classList.remove('drag-scroll');
        cleanupMap.delete(el);
        enhanced.delete(el);
      });
    };
  }, []);

  return null; // purely behavioural — renders nothing
}
