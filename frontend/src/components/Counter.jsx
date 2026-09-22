"use client";

import { useEffect, useRef, useState } from "react";

function inr(n) {
  return Math.round(n).toLocaleString("en-IN");
}

function formatValue(value, { fmt, decimals = 0, suffix = "" }) {
  if (fmt === "inr") return inr(value) + suffix;
  const body = decimals ? value.toFixed(decimals) : Math.round(value).toLocaleString("en-IN");
  return body + suffix;
}

/**
 * Animated count-up number. Replaces the original vanilla-JS
 * `countUp()` + IntersectionObserver logic with a React version.
 */
export default function Counter({ to, fmt, decimals = 0, suffix = "", prefix = "" }) {
  const [display, setDisplay] = useState("0");
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const target = Number(to) || 0;

    if (reduceMotion.current) {
      setDisplay(formatValue(target, { fmt, decimals, suffix }));
      return;
    }

    let raf;
    const duration = 1200;
    const start = performance.now();

    function step(t) {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(formatValue(target * eased, { fmt, decimals, suffix }));
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, fmt, decimals, suffix]);

  return (
    <>
      {prefix}
      {display}
    </>
  );
}
