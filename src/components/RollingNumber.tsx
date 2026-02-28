import { useEffect, useRef, useState } from "react";

const ROLL_DURATION_MS = 580;

function toDigits(n: number): number[] {
  const s = Math.max(0, Math.floor(n)).toString();
  return s.split("").map(Number);
}

function padDigits(digits: number[], len: number): number[] {
  if (digits.length >= len) return digits.slice(-len);
  return [...Array(len - digits.length).fill(0), ...digits];
}

export function RollingNumber({
  value,
  className,
  style,
}: {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [displayDigits, setDisplayDigits] = useState<number[]>(() => toDigits(value));
  const prevValueRef = useRef(value);
  const isFirstRef = useRef(true);

  useEffect(() => {
    const prev = prevValueRef.current;
    if (value === prev && !isFirstRef.current) return;
    isFirstRef.current = false;
    prevValueRef.current = value;
    const prevD = toDigits(prev);
    const targetD = toDigits(value);
    const len = Math.max(prevD.length, targetD.length, 1);
    const paddedPrev = padDigits(prevD, len);
    const paddedTarget = padDigits(targetD, len);
    setDisplayDigits(paddedPrev);
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDisplayDigits(paddedTarget);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const digitCount = Math.max(1, toDigits(value).length);
  const digits = displayDigits.length >= digitCount ? displayDigits.slice(-digitCount) : toDigits(value);

  return (
    <span className={className} style={{ display: "inline-flex", verticalAlign: "middle", ...style }}>
      {digits.map((d, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            height: "1em",
            overflow: "hidden",
            verticalAlign: "top",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              display: "block",
              transform: `translateY(-${d}em)`,
              transition: `transform ${ROLL_DURATION_MS}ms linear`,
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <span key={n} style={{ display: "block", height: "1em", textAlign: "center" }}>
                {n}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
