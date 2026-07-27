import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';

/** Shrinks text to fit its container width; recenters on resize / content change. */
export function FitText({
  children,
  className,
  maxFontSize = 22,
  minFontSize = 11,
  style,
}: {
  children: ReactNode;
  className?: string;
  maxFontSize?: number;
  minFontSize?: number;
  style?: CSSProperties;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return;

    const fit = () => {
      const maxW = Math.max(0, box.clientWidth);
      if (maxW <= 0) return;
      let lo = minFontSize;
      let hi = maxFontSize;
      let best = minFontSize;
      while (lo <= hi) {
        const mid = Math.round((lo + hi) * 4) / 4;
        el.style.fontSize = `${mid}px`;
        if (el.scrollWidth <= maxW + 0.5) {
          best = mid;
          lo = mid + 0.25;
        } else {
          hi = mid - 0.25;
        }
      }
      el.style.fontSize = `${best}px`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [children, maxFontSize, minFontSize]);

  return (
    <div
      ref={boxRef}
      className={['fit-text', className].filter(Boolean).join(' ')}
      style={style}
    >
      <span ref={textRef} className="fit-text-inner">
        {children}
      </span>
    </div>
  );
}
