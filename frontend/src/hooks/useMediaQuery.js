import { useEffect, useState } from "react";

/**
 * Subscribe to a media query. Used by the header's two-stage collapse, where
 * moving controls into an overflow menu is a DOM change CSS cannot express.
 * jsdom has no matchMedia — setupTests.js stubs a never-matching one.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
