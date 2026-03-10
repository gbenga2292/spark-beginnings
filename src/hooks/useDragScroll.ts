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

  const onMouseDown = (e: MouseEvent) => {
    // Only trigger on left button; ignore clicks on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('button, a, input, select, textarea, [role="button"], [tabindex]')
    ) return;

    isDown = true;
    el.dataset.dragScrolling = 'true';
    startX = e.pageX - el.offsetLeft;
    startY = e.pageY - el.offsetTop;
    scrollLeft = el.scrollLeft;
    scrollTop = el.scrollTop;
    e.preventDefault();
  };

  const onMouseLeave = () => {
    isDown = false;
    delete el.dataset.dragScrolling;
  };

  const onMouseUp = () => {
    isDown = false;
    delete el.dataset.dragScrolling;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const y = e.pageY - el.offsetTop;
    const walkX = (x - startX) * 1.2; // slight multiplier for snappy feel
    const walkY = (y - startY) * 1.2;
    el.scrollLeft = scrollLeft - walkX;
    el.scrollTop  = scrollTop  - walkY;
  };

  el.addEventListener('mousedown', onMouseDown);
  el.addEventListener('mouseleave', onMouseLeave);
  el.addEventListener('mouseup', onMouseUp);
  el.addEventListener('mousemove', onMouseMove);

  return () => {
    el.removeEventListener('mousedown', onMouseDown);
    el.removeEventListener('mouseleave', onMouseLeave);
    el.removeEventListener('mouseup', onMouseUp);
    el.removeEventListener('mousemove', onMouseMove);
    delete el.dataset.dragScrolling;
  };
}
