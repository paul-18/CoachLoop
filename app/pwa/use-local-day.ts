import { useEffect, useState } from "react";
import { localDate } from "../domain/training-types";
export function useLocalDay() {
  const [day, setDay] = useState(localDate);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setDay(localDate()); clearTimeout(timer);
      const next = new Date(); next.setHours(24, 0, 1, 0);
      timer = setTimeout(refresh, next.getTime() - Date.now());
    };
    refresh(); document.addEventListener("visibilitychange", refresh);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return day;
}
