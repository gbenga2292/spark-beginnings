import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';

interface PageContextType {
  title: string;
  setTitle: (title: string) => void;
  headerButtons: ReactNode | null;
  setHeaderButtons: (buttons: ReactNode | null) => void;
  subtitle: string;
  setSubtitle: (subtitle: string) => void;
}

const PageContext = createContext<PageContextType | undefined>(undefined);

export function PageProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [headerButtons, setHeaderButtons] = useState<ReactNode | null>(null);

  return (
    <PageContext.Provider value={{ title, setTitle, headerButtons, setHeaderButtons, subtitle, setSubtitle }}>
      {children}
    </PageContext.Provider>
  );
}

export function usePage() {
  const context = useContext(PageContext);
  if (context === undefined) {
    throw new Error('usePage must be used within a PageProvider');
  }
  return context;
}

/**
 * Hook to set the page title and subtitle easily.
 * NOTE: `buttons` must be stable (e.g. wrapped in useMemo at the call site)
 * or passed as null/undefined to avoid infinite re-render loops.
 */
export function useSetPageTitle(title: string, subtitle: string = '', buttons: ReactNode | null = null) {
  const { setTitle, setSubtitle, setHeaderButtons } = usePage();
  // Use a ref to hold the latest buttons value so we never include it
  // in the dep array — JSX creates a new object reference on every render.
  const buttonsRef = useRef(buttons);
  buttonsRef.current = buttons;

  useEffect(() => {
    setTitle(title);
    setSubtitle(subtitle);
    // Read from ref so JSX buttons don't trigger an infinite re-render loop
    setHeaderButtons(buttonsRef.current);

    // Cleanup on unmount
    return () => {
      setTitle('');
      setSubtitle('');
      setHeaderButtons(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, setTitle, setSubtitle, setHeaderButtons]);
}
