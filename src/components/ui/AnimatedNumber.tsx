import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/** Smoothly animates between numeric values without re-rendering React on every frame. */
export function AnimatedNumber({ value, format, className }: { value: number | null | undefined; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  const reduce = useReducedMotion();
  const flashRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value == null || !Number.isFinite(value)) {
      el.textContent = '—';
      prev.current = null;
      return;
    }
    const from = prev.current;
    prev.current = value;
    if (from == null || reduce) {
      el.textContent = format(value);
      return;
    }
    if (from !== value) {
      el.dataset.flash = value > from ? 'up' : 'down';
      if (flashRef.current) window.clearTimeout(flashRef.current);
      flashRef.current = window.setTimeout(() => {
        if (el) delete el.dataset.flash;
      }, 700);
    }
    const controls = animate(from, value, {
      duration: 0.6,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, format, reduce]);

  return (
    <span
      ref={ref}
      className={`num transition-colors duration-500 data-[flash=down]:text-bear data-[flash=up]:text-bull ${className ?? ''}`}
    />
  );
}
