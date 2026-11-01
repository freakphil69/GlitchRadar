import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "glitchradar.recentSearches";
const MAX = 8;

export const POPULAR_SEARCHES = ["Lieferando", "PS5", "AirPods", "Lego", "Dyson", "iPhone", "Nintendo Switch", "Gratis"];

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setRecent(v ? JSON.parse(v) : []))
      .catch(() => setRecent([]));
  }, []);

  const persist = (next: string[]) => {
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    return next;
  };

  const add = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setRecent((prev) => persist([t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX)));
  }, []);

  const clear = useCallback(() => setRecent(persist([])), []);

  return { recent, add, clear };
}
