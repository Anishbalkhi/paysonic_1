import React, { useEffect, useRef } from "react";

export default function Script({ src, onLoad, strategy }) {
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (!src || hasTriggeredRef.current) return;

    const triggerOnLoad = () => {
      if (!hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        onLoadRef.current?.();
      }
    };

    if (typeof window !== "undefined") {
      if (src.includes("Chart") && window.Chart) {
        triggerOnLoad();
        return;
      }
      if (src.includes("three") && window.THREE) {
        triggerOnLoad();
        return;
      }
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      triggerOnLoad();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = triggerOnLoad;
    document.body.appendChild(script);
  }, [src]);

  return null;
}
