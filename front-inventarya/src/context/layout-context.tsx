import React, { createContext, useContext, useState } from 'react';

interface LayoutContextType {
  // Mobile drawer open state
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  // Desktop compact rail mode state
  isCompact: boolean;
  setIsCompact: (value: boolean) => void;
  toggleCompact: () => void;
}

export const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebar_compact') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCompact = () => {
    setIsCompact((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_compact', String(next));
      } catch {}
      return next;
    });
  };

  return (
    <LayoutContext.Provider
      value={{
        collapsed,
        setCollapsed,
        isCompact,
        setIsCompact,
        toggleCompact,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useSidebarContext = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useSidebarContext must be used within a LayoutProvider');
  }
  return context;
};

