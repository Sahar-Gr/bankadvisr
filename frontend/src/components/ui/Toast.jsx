import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((type, message) => {
    const id = Math.random().toString(36).slice(2);
    setItems((arr) => [...arr, { id, type, message }]);
    setTimeout(() => {
      setItems((arr) => arr.filter((x) => x.id !== id));
    }, 3500);
  }, []);

  const api = useMemo(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
    }),
    [push]
  );

  const getToastStyle = (type) => {
    if (type === "success") {
      return {
        background: "var(--success)",
        color: "#fff",
      };
    }
    if (type === "error") {
      return {
        background: "var(--danger)",
        color: "#fff",
      };
    }
    return {
      background: "var(--bg-card)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-strong)",
    };
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="min-w-[260px] max-w-[420px] rounded-xl px-4 py-3 shadow-lg text-sm"
            style={getToastStyle(t.type)}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}