import { createContext, useContext, useState, ReactNode, useEffect, useRef, useMemo } from 'react';

// State definition
interface PageState {
  title: string;
  headerButtons: ReactNode | null;
  subtitle: string;
}

// Dispatch definition
interface PageDispatch {
  setTitle: (title: string) => void;
  setHeaderButtons: (buttons: ReactNode | null) => void;
  setSubtitle: (subtitle: string) => void;
}

const PageStateContext = createContext<PageState | undefined>(undefined);
const PageDispatchContext = createContext<PageDispatch | undefined>(undefined);

export function PageProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [headerButtons, setHeaderButtons] = useState<ReactNode | null>(null);

  const stateValue = useMemo(() => ({ title, subtitle, headerButtons }), [title, subtitle, headerButtons]);
  const dispatchValue = useMemo(() => ({ setTitle, setSubtitle, setHeaderButtons }), []);

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
 * Hook to set the page title and subtitle easily.
 * Because it consumes the dispatch context, updating the title will NO LONGER
 * trigger a double-render inside the calling page component.
 */
export function useSetPageTitle(title: string | null, subtitle: string = '', buttons: ReactNode | null = null, deps: any[] = []) {
  const dispatch = useContext(PageDispatchContext);

  // Keep hook call order unconditional (Rules of Hooks)
  const buttonsRef = useRef(buttons);
  buttonsRef.current = buttons;

  useEffect(() => {
    if (!dispatch || title === null) return;

    const { setTitle, setSubtitle, setHeaderButtons } = dispatch;
    setTitle(title);
    setSubtitle(subtitle);
    setHeaderButtons(buttonsRef.current);

    return () => {
      setTitle('');
      setSubtitle('');
      setHeaderButtons(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, title, subtitle, ...deps]);
}

