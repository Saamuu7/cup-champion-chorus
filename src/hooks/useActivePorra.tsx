import { useEffect, useState } from "react";

const KEY = "active_porra_id";

export function getActivePorraId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setActivePorraId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("active-porra-changed"));
}

export function useActivePorra() {
  const [id, setId] = useState<string | null>(() => getActivePorraId());
  useEffect(() => {
    const h = () => setId(getActivePorraId());
    window.addEventListener("active-porra-changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("active-porra-changed", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return { porraId: id, setPorraId: setActivePorraId };
}
