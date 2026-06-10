import { createContext, useContext, useState, ReactNode, useEffect, useRef, useMemo, useCallback } from 'react';

// State definition
interface PageState {
  title: ReactNode;
  headerButtons: ReactNode | null;
  subtitle: ReactNode;
  showBackButton: boolean | (() => void);
}

// Dispatch definition
interface PageDispatch {
  setTitle: (title: ReactNode) => void;
  setHeaderButtons: (buttons: ReactNode | null) => void;
  setSubtitle: (subtitle: ReactNode) => void;
  setShowBackButton: (show: boolean | (() => void)) => void;
}

const PageStateContext = createContext<PageState | undefined>(undefined);
const PageDispatchContext = createContext<PageDispatch | undefined>(undefined);

export function PageProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<ReactNode>('');
  const [subtitle, setSubtitle] = useState<ReactNode>('');
  const [headerButtons, setHeaderButtons] = useState<ReactNode | null>(null);
  const [showBackButton, setShowBackButton] = useState<boolean | (() => void)>(false);

  const stateValue = useMemo(() => ({ title, subtitle, headerButtons, showBackButton }), [title, subtitle, headerButtons, showBackButton]);
  const dispatchValue = useMemo(() => ({ setTitle, setSubtitle, setHeaderButtons, setShowBackButton }), []);

  return (
    <PageStateContext.Provider value={stateValue}>
      <PageDispatchContext.Provider value={dispatchValue}>
        {children}
      </PageDispatchContext.Provider>
    </PageStateContext.Provider>
  );
}

export function usePage() {
  const context = useContext(PageStateContext);
  if (context === undefined) {
    throw new Error('usePage must be used within a PageProvider');
  }
  return context;
}

/**
 * Hook to set the page title, subtitle, and header buttons.
 *
 * Uses a generation counter to ensure that when a child component unmounts and
 * a parent re-renders, the parent's title wins — preventing the "stuck on Dashboard"
 * bug caused by the child's cleanup clearing the header before the parent can re-set it.
 */

// Global generation counter — incremented on every mount so newest caller wins
let _generation = 0;
export function useSetPageTitle(
  title: ReactNode | null,
  subtitle: ReactNode = '',
  buttons: ReactNode | null = null,
  deps: any[] = [],
  showBackButton: boolean | (() => void) = false
) {
  const dispatch = useContext(PageDispatchContext);

  // Capture buttons in a ref so JSX closures don't cause stale values
  const buttonsRef = useRef(buttons);
  buttonsRef.current = buttons;

  // Capture showBackButton callback in a ref so it never gets stale
  const showBackButtonRef = useRef(showBackButton);
  showBackButtonRef.current = showBackButton;

  // This component's generation — set on first mount, stays stable
  const generationRef = useRef<number>(-1);

  useEffect(() => {
    if (!dispatch || title === null) return;

    // Claim a new generation on mount
    _generation += 1;
    const myGen = _generation;
    generationRef.current = myGen;

    const { setTitle, setSubtitle, setHeaderButtons, setShowBackButton } = dispatch;
    setTitle(title);
    setSubtitle(subtitle);
    setHeaderButtons(buttonsRef.current);

    // Set callback via a stable wrapper function that accesses the latest ref
    if (typeof showBackButton === 'function') {
      setShowBackButton(() => () => {
        if (typeof showBackButtonRef.current === 'function') {
          showBackButtonRef.current();
        }
      });
    } else {
      setShowBackButton(showBackButton);
    }

    return () => {
      // Only clear if we are still the latest owner (i.e. no newer component mounted yet)
      // A brief timeout allows the incoming component to mount and claim ownership first
      const capturedGen = myGen;
      setTimeout(() => {
        if (_generation === capturedGen) {
          // We were the last one — safe to clear
          setTitle('');
          setSubtitle('');
          setHeaderButtons(null);
          setShowBackButton(false);
        }
        // else: a newer component already set the title — don't touch it
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, title, subtitle, ...deps]);
}
