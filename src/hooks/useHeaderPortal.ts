import { useEffect, useState } from 'react';

const HEADER_PORTAL_ID = 'header-buttons-portal';

/**
 * Returns the DOM element for the header-buttons portal target.
 * Used by Layout/Header to create the mount point, and by pages to portal into it.
 */
export function useHeaderPortalTarget() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Try to find existing, or wait for it
    const find = () => document.getElementById(HEADER_PORTAL_ID);
    const el = find();
    if (el) {
      setTarget(el);
      return;
    }
    // MutationObserver fallback for when the header mounts after the page
    const observer = new MutationObserver(() => {
      const el = find();
      if (el) {
        setTarget(el);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return target;
}

export { HEADER_PORTAL_ID };
