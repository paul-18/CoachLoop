import { useEffect, useState } from "react";
import { localDate } from "../domain/training-types";
export function useLocalDay() {
  const [day, setDay] = useState(localDate);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setDay(localDate()); clearTimeout(timer);
      const next = new Date(); next.setHours(24, 0, 1, 0);
      timer = setTimeout(refresh, next.getTime() - Date.now());
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return day;
}
