import React from "react";

const palettes = [
  ["#1d4ed8", "#38bdf8"],
  ["#7c3aed", "#f472b6"],
  ["#c2410c", "#fb923c"],
  ["#047857", "#34d399"],
  ["#b91c1c", "#fb7185"],
  ["#334155", "#94a3b8"],
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "MK";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getPaletteIndex(name: string) {
  return Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
}

export function MarkitAvatar({
  name,
  size = 24,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const [start, end] = palettes[getPaletteIndex(name)];
  const initials = getInitials(name);

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${start} 0%, ${end} 100%)`,
        color: "#ffffff",
        fontSize: Math.max(10, Math.round(size * 0.38)),
        fontWeight: 700,
        letterSpacing: "-0.02em",
        boxShadow: "0 3px 10px rgba(15, 23, 42, 0.18)",
      }}
    >
      {initials}
    </span>
  );
}

export default MarkitAvatar;
