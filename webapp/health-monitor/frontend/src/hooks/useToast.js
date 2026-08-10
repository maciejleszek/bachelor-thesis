import { useState, useCallback } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);

  const show = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const Toast = toast
    ? <div className={`toast${toast.type === "error" ? " error" : ""}`}>{toast.msg}</div>
    : null;

  return { show, Toast };
}
