"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type AdminDirtyContextValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  onSaveRequest: (() => Promise<void>) | null;
  registerSaveHandler: (handler: () => Promise<void>) => void;
  unregisterSaveHandler: () => void;
  pendingNav: string | null;
  setPendingNav: (href: string | null) => void;
  requestNavigation: (href: string) => void;
};

const AdminDirtyContext = createContext<AdminDirtyContextValue | null>(null);

export function AdminDirtyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isDirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const [saveHandler, setSaveHandler] = useState<(() => Promise<void>) | null>(
    null
  );

  const registerSaveHandler = useCallback((handler: () => Promise<void>) => {
    setSaveHandler(() => handler);
  }, []);

  const unregisterSaveHandler = useCallback(() => {
    setSaveHandler(null);
  }, []);

  const requestNavigation = useCallback(
    (href: string) => {
      if (isDirty) {
        setPendingNav(href);
      } else {
        router.push(href);
      }
    },
    [isDirty, router]
  );

  const value = useMemo<AdminDirtyContextValue>(
    () => ({
      isDirty,
      setDirty,
      onSaveRequest: saveHandler,
      registerSaveHandler,
      unregisterSaveHandler,
      pendingNav,
      setPendingNav,
      requestNavigation,
    }),
    [
      isDirty,
      saveHandler,
      registerSaveHandler,
      unregisterSaveHandler,
      pendingNav,
      requestNavigation,
    ]
  );

  return (
    <AdminDirtyContext.Provider value={value}>
      {children}
    </AdminDirtyContext.Provider>
  );
}

export function useAdminDirty() {
  const ctx = useContext(AdminDirtyContext);
  if (!ctx) {
    return null;
  }
  return ctx;
}
