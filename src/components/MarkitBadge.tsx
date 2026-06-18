import React from "react";

export function MarkitBadge({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="100" height="100" rx="24" fill="#FE2C55" />
      <path
        d="M30 30L50 50L70 30M30 70L50 50L70 70"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="50" cy="50" r="8" fill="white" />
    </svg>
  );
}

export default MarkitBadge;
