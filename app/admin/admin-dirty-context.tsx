"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AdminDirtyContextValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  onSaveRequest: (() => Promise<void>) | null;
  registerSaveHandler: (handler: () => Promise<void>) => void;
  unregisterSaveHandler: () => void;
};

const AdminDirtyContext = createContext<AdminDirtyContextValue | null>(null);

export function AdminDirtyProvider({ children }: { children: ReactNode }) {
  const [isDirty, setDirty] = useState(false);
  const [saveHandler, setSaveHandler] = useState<(() => Promise<void>) | null>(
    null
  );

  const registerSaveHandler = useCallback((handler: () => Promise<void>) => {
    setSaveHandler(() => handler);
  }, []);

  const unregisterSaveHandler = useCallback(() => {
    setSaveHandler(null);
  }, []);

  const value = useMemo<AdminDirtyContextValue>(
    () => ({
      isDirty,
      setDirty,
      onSaveRequest: saveHandler,
      registerSaveHandler,
      unregisterSaveHandler,
    }),
    [isDirty, saveHandler, registerSaveHandler, unregisterSaveHandler]
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
