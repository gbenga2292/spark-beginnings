import { useEffect, useRef } from 'react';

/**
 * Attaches click-and-drag horizontal (and vertical) scroll behaviour to a container.
 * - Cursor shows 'grab' on hover, 'grabbing' while dragging.
 * - Mouse movement while button held pans the scrollable content.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return attachDragScroll(el);
  }, []);

  return ref;
}

/**
 * Standalone helper – attach drag-scroll to any DOM element and return a cleanup fn.
 * Used both by the hook and the global initialiser.
 */
export function attachDragScroll(el: HTMLElement): () => void {
  let isDown = false;
  let startX = 0;
  let startY = 0;
  let scrollLeft = 0;
  let scrollTop = 0;

  const onMouseUp = () => {
    if (!isDown) return;
    isDown = false;
    delete el.dataset.dragScrolling;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    const walkX = (x - startX) * 1.25; // Adjusted for a completely natural feel
    const walkY = (y - startY) * 1.25;
    el.scrollLeft = scrollLeft - walkX;
    el.scrollTop  = scrollTop  - walkY;
  };

  const onMouseDown = (e: MouseEvent) => {
    // Only trigger on left button; ignore clicks on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      e.ctrlKey ||
      target.closest('button, a, input, select, textarea, [role="button"], [tabindex]') || 
      target.closest('.no-drag')
    ) return;

    isDown = true;
    el.dataset.dragScrolling = 'true';
    startX = e.clientX;
    startY = e.clientY;
    scrollLeft = el.scrollLeft;
    scrollTop = el.scrollTop;
    
    // Attach to window so fast dragging doesn't lose the cursor outside the element
    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', onMouseUp);
  };

  el.addEventListener('mousedown', onMouseDown);

  return () => {
    el.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    delete el.dataset.dragScrolling;
  };
}
