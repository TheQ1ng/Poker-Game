import React from "react";

export type ArtworkVariant =
  | "fashion-red"
  | "workspace"
  | "skincare"
  | "headphones"
  | "pancakes"
  | "brunch"
  | "lagoon"
  | "sanctuary"
  | "editorial"
  | "curtain"
  | "hero-office";

function Circle({
  cx,
  cy,
  r,
  fill,
  opacity,
  stroke,
  strokeWidth,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number | string;
}) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} opacity={opacity} stroke={stroke} strokeWidth={strokeWidth} />;
}

function Rect({
  x,
  y,
  width,
  height,
  fill,
  rx = 0,
  opacity,
  transform,
  stroke,
  strokeWidth,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  rx?: number;
  opacity?: number;
  transform?: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      rx={rx}
      opacity={opacity}
      transform={transform}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

function FashionRed() {
  return (
    <>
      <defs>
        <linearGradient id="fashion-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#0b1220" />
        </linearGradient>
      </defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#fashion-bg)" />
      <Rect x={0} y={55} width={100} height={45} fill="#b79d7d" />
      <Rect x={54} y={14} width={38} height={86} fill="#111827" opacity={0.55} />
      <Rect x={8} y={8} width={12} height={92} fill="#111827" opacity={0.45} />
      <Rect x={26} y={10} width={8} height={90} fill="#111827" opacity={0.4} />
      <Circle cx={47} cy={34} r={7} fill="#f2c8b5" />
      <Rect x={37} y={41} width={20} height={27} rx={6} fill="#ef4444" />
      <Rect x={31} y={44} width={12} height={24} rx={6} fill="#f87171" transform="rotate(12 31 44)" />
      <Rect x={51} y={44} width={12} height={24} rx={6} fill="#f87171" transform="rotate(-12 51 44)" />
      <Rect x={39} y={66} width={7} height={24} rx={3} fill="#ef4444" />
      <Rect x={49} y={66} width={7} height={24} rx={3} fill="#ef4444" />
      <Rect x={34} y={90} width={14} height={3} rx={1.5} fill="#111827" />
      <Rect x={48} y={90} width={14} height={3} rx={1.5} fill="#111827" />
      <Rect x={4} y={75} width={38} height={6} fill="#0f172a" opacity={0.3} transform="rotate(-22 4 75)" />
    </>
  );
}

function Workspace() {
  return (
    <>
      <defs>
        <linearGradient id="workspace-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="60%" stopColor="#dbe4ea" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#workspace-bg)" />
      <Rect x={0} y={65} width={100} height={35} fill="#c89263" />
      <Rect x={0} y={0} width={38} height={42} fill="#f8fafc" opacity={0.9} />
      <Rect x={15} y={22} width={48} height={26} rx={3} fill="#94a3b8" transform="rotate(7 15 22)" />
      <Rect x={18} y={24} width={42} height={20} rx={2} fill="#3b5569" transform="rotate(7 18 24)" />
      <Rect x={27} y={50} width={28} height={3} fill="#64748b" transform="rotate(7 27 50)" />
      <Rect x={6} y={50} width={18} height={6} rx={3} fill="#e5e7eb" />
      <Circle cx={15} cy={48} r={9} fill="#d9f99d" />
      <Rect x={11} y={38} width={8} height={10} rx={4} fill="#84cc16" />
    </>
  );
}

function Skincare() {
  return (
    <>
      <defs>
        <radialGradient id="skincare-bg" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#83c5be" />
          <stop offset="70%" stopColor="#3f6c72" />
          <stop offset="100%" stopColor="#1f3d44" />
        </radialGradient>
      </defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#skincare-bg)" />
      <Rect x={0} y={68} width={100} height={32} fill="#1f4f58" />
      <Rect x={0} y={72} width={100} height={28} fill="#ffffff" opacity={0.08} />
      <Rect x={34} y={25} width={15} height={38} rx={5} fill="#f8fafc" />
      <Rect x={39} y={19} width={5} height={8} rx={2} fill="#c98c2b" />
      <Rect x={51} y={37} width={10} height={24} rx={3} fill="#f8fafc" />
      <Rect x={54} y={31} width={4} height={7} rx={1.5} fill="#c98c2b" />
      <Rect x={65} y={34} width={7} height={20} rx={2} fill="#f8fafc" />
      <Circle cx={24} cy={58} r={4} fill="#f9a8d4" opacity={0.9} />
      <Circle cx={29} cy={53} r={3} fill="#fbcfe8" />
      <Circle cx={20} cy={51} r={2.5} fill="#f9a8d4" />
      <Circle cx={72} cy={24} r={2.5} fill="#fbcfe8" />
      <Circle cx={60} cy={16} r={2} fill="#fde68a" />
    </>
  );
}

function Headphones() {
  return (
    <>
      <defs>
        <radialGradient id="headphones-bg" cx="55%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#05070b" />
        </radialGradient>
      </defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#headphones-bg)" />
      <Rect
        x={8}
        y={58}
        width={62}
        height={26}
        rx={4}
        fill="#0f172a"
        stroke="#22d3ee"
        strokeWidth={0.8}
        opacity={0.95}
      />
      <Rect x={10} y={60} width={58} height={22} rx={3} fill="#1e293b" />
      <path d="M55 57 C60 34, 77 34, 84 52" fill="none" stroke="#0f172a" strokeWidth="8" strokeLinecap="round" />
      <Circle cx={60} cy={61} r={10} fill="#0f172a" />
      <Circle cx={60} cy={61} r={7} fill="#111827" stroke="#22d3ee" strokeWidth="1.5" />
      <Circle cx={82} cy={56} r={9} fill="#111827" />
      <Rect x={74} y={46} width={6} height={12} rx={3} fill="#0f172a" transform="rotate(-16 74 46)" />
      <Circle cx={16} cy={54} r={5} fill="#111827" />
    </>
  );
}

function Pancakes() {
  return (
    <>
      <defs>
        <linearGradient id="pancake-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4b2e1f" />
          <stop offset="100%" stopColor="#1c120d" />
        </linearGradient>
      </defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#pancake-bg)" />
      <Rect x={0} y={0} width={100} height={18} fill="#8b5e3c" opacity={0.35} />
      <Circle cx={50} cy={80} r={24} fill="#f5f5f4" />
      <Rect x={28} y={46} width={44} height={8} rx={4} fill="#f0b35a" />
      <Rect x={27} y={53} width={46} height={8} rx={4} fill="#eab15a" />
      <Rect x={26} y={60} width={48} height={8} rx={4} fill="#efb45f" />
      <Rect x={25} y={67} width={50} height={8} rx={4} fill="#eab15a" />
      <Rect x={24} y={74} width={52} height={8} rx={4} fill="#efb45f" />
      <Rect x={42} y={39} width={16} height={4} rx={2} fill="#facc15" />
      <Rect x={47} y={35} width={6} height={6} rx={2} fill="#fde68a" />
      <path d="M48 42 C42 52, 44 61, 40 70" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
      <path d="M55 43 C57 54, 59 60, 61 67" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M66 18 C63 25, 69 28, 66 35" fill="none" stroke="#d1d5db" strokeWidth="1.8" opacity={0.6} />
      <path d="M72 14 C69 22, 76 25, 73 34" fill="none" stroke="#d1d5db" strokeWidth="1.4" opacity={0.4} />
    </>
  );
}

function Brunch() {
  return (
    <>
      <defs>
        <linearGradient id="brunch-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#edf6f9" />
          <stop offset="100%" stopColor="#dbeafe" />
        </linearGradient>
      </defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#brunch-bg)" />
      <Circle cx={29} cy={58} r={24} fill="#0f766e" />
      <Circle cx={29} cy={58} r={20} fill="#134e4a" opacity={0.12} />
      <Rect x={18} y={51} width={22} height={10} rx={5} fill="#9acd6b" transform="rotate(-18 18 51)" />
      <Circle cx={24} cy={54} r={5} fill="#fff7ed" />
      <Circle cx={32} cy={51} r={5} fill="#fff7ed" />
      <Circle cx={24} cy={54} r={1.1} fill="#f59e0b" />
      <Circle cx={32} cy={51} r={1.1} fill="#f59e0b" />
      <Circle cx={72} cy={34} r={16} fill="#0f766e" />
      <Circle cx={72} cy={34} r={12} fill="#f59e0b" />
      <path d="M66 34 C69 28, 74 28, 77 34 C74 38, 69 38, 66 34 Z" fill="#f8fafc" />
      <Circle cx={75} cy={60} r={15} fill="#0f766e" />
      <Circle cx={75} cy={60} r={11} fill="#f59e0b" />
      <path d="M69 60 C72 54, 77 54, 80 60 C77 64, 72 64, 69 60 Z" fill="#f8fafc" />
    </>
  );
}

function Lagoon() {
  return (
    <>
      <defs>
        <linearGradient id="lagoon-sky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#bfdbfe" />
        </linearGradient>
      </defs>
      <Rect x={0} y={0} width={100} height={48} fill="url(#lagoon-sky)" />
      <Rect x={0} y={48} width={100} height={52} fill="#0ea5e9" />
      <path d="M0 52 C16 24, 20 18, 33 0 L0 0 Z" fill="#475569" />
      <path d="M0 52 C14 28, 18 20, 30 2" fill="none" stroke="#65a30d" strokeWidth="7" strokeLinecap="round" />
      <path d="M100 52 C84 24, 80 18, 67 0 L100 0 Z" fill="#475569" />
      <path d="M100 52 C86 28, 82 20, 70 2" fill="none" stroke="#65a30d" strokeWidth="7" strokeLinecap="round" />
      <path d="M43 47 C50 32, 56 22, 62 12 C68 22, 72 33, 74 47 Z" fill="#64748b" />
      <path d="M43 47 C50 34, 55 26, 61 16" fill="none" stroke="#84cc16" strokeWidth="5" strokeLinecap="round" />
      <path d="M0 72 C18 70, 30 76, 50 74 C68 72, 83 77, 100 72" fill="none" stroke="#67e8f9" strokeWidth="1.6" opacity={0.6} />
      <path d="M0 80 C18 78, 30 84, 50 82 C68 80, 83 85, 100 80" fill="none" stroke="#67e8f9" strokeWidth="1.6" opacity={0.6} />
    </>
  );
}

function Sanctuary() {
  return (
    <>
      <defs>
        <linearGradient id="sanctuary-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f7f4ef" />
          <stop offset="100%" stopColor="#ddd6c8" />
        </linearGradient>
      </defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#sanctuary-bg)" />
      <Rect x={0} y={80} width={100} height={20} fill="#d6c4aa" />
      <Rect x={34} y={12} width={32} height={54} rx={16} fill="#f9fafb" />
      <Rect x={49} y={12} width={2} height={54} fill="#e5e7eb" />
      <Circle cx={18} cy={74} r={9} fill="#d6d3d1" />
      <Rect x={14} y={56} width={8} height={18} rx={4} fill="#4d7c0f" />
      <Circle cx={18} cy={54} r={11} fill="#65a30d" />
      <Rect x={27} y={62} width={42} height={16} rx={8} fill="#fafaf9" />
      <Rect x={39} y={72} width={20} height={4} rx={2} fill="#e7e5e4" />
      <Rect x={53} y={69} width={10} height={10} rx={5} fill="#d6d3d1" />
      <Rect x={51} y={63} width={3} height={10} rx={1.5} fill="#a8a29e" />
    </>
  );
}

function Editorial() {
  return (
    <>
      <defs>
        <linearGradient id="editorial-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#d1d5db" />
        </linearGradient>
      </defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#editorial-bg)" />
      <Circle cx={50} cy={28} r={8} fill="#f2c8b5" />
      <Rect x={38} y={36} width={24} height={28} rx={10} fill="#d6c3b1" />
      <Rect x={30} y={37} width={15} height={14} rx={7} fill="#cbd5e1" transform="rotate(-20 30 37)" />
      <Rect x={55} y={37} width={15} height={14} rx={7} fill="#cbd5e1" transform="rotate(20 55 37)" />
      <Rect x={42} y={63} width={6} height={22} rx={3} fill="#d6c3b1" />
      <Rect x={52} y={63} width={6} height={22} rx={3} fill="#d6c3b1" />
      <Rect x={38} y={82} width={12} height={3} rx={1.5} fill="#475569" />
      <Rect x={50} y={82} width={12} height={3} rx={1.5} fill="#475569" />
      <Circle cx={88} cy={56} r={14} fill="#111827" opacity={0.18} />
    </>
  );
}

function Curtain() {
  return (
    <>
      <Rect x={0} y={0} width={100} height={100} fill="#ffffff" />
      {[
        ["#ef4444", 0],
        ["#dc2626", 8],
        ["#f87171", 16],
        ["#b91c1c", 24],
        ["#ef4444", 32],
        ["#fca5a5", 40],
        ["#dc2626", 48],
        ["#ef4444", 56],
        ["#b91c1c", 64],
        ["#f87171", 72],
        ["#dc2626", 80],
      ].map(([color, x], index) => (
        <Rect key={index} x={Number(x)} y={0} width={8} height={72} fill={String(color)} opacity={0.86} />
      ))}
      <Rect x={0} y={72} width={100} height={28} fill="#f1f5f9" />
      <Rect x={0} y={72} width={100} height={28} fill="#dc2626" opacity={0.08} />
    </>
  );
}

function HeroOffice() {
  return (
    <>
      <defs>
        <linearGradient id="hero-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#120403" />
          <stop offset="45%" stopColor="#4a0f0f" />
          <stop offset="100%" stopColor="#0b0911" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="24%" cy="72%" r="45%">
          <stop offset="0%" stopColor="#ff5f42" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#ff5f42" stopOpacity="0" />
        </radialGradient>
      </defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#hero-bg)" />
      <Rect x={0} y={0} width={100} height={100} fill="url(#hero-glow)" />
      <Rect x={0} y={78} width={100} height={22} fill="#080b12" opacity={0.82} />
      <Rect x={0} y={24} width={100} height={2} fill="#140f11" opacity={0.7} />
      <Rect x={0} y={18} width={100} height={1.5} fill="#291516" opacity={0.5} />
      <Rect x={4} y={34} width={12} height={28} fill="#fff7ed" opacity={0.88} />
      <Rect x={5} y={35} width={10} height={26} fill="#ffffff" opacity={0.35} />
      <Rect x={55} y={42} width={20} height={1} fill="#f8fafc" opacity={0.85} />
      <Rect x={58} y={44} width={16} height={0.8} fill="#f8fafc" opacity={0.4} />
      <Rect x={78} y={43} width={3} height={14} fill="#ff3b30" opacity={0.95} />
      <Rect x={80} y={42} width={10} height={2} fill="#ff3b30" opacity={0.95} />
      <Rect x={67} y={36} width={1.2} height={24} fill="#ff4336" transform="rotate(-52 67 36)" />
      <Rect x={71} y={42} width={1.2} height={24} fill="#ff4336" transform="rotate(-52 71 42)" />
      <Rect x={16} y={60} width={12} height={9} rx={1} fill="#1e293b" />
      <Rect x={46} y={61} width={8} height={7} rx={1} fill="#1e293b" />
      <Rect x={78} y={62} width={7} height={7} rx={1} fill="#1e293b" />
      <Rect x={13} y={69} width={20} height={2} fill="#3f2b28" />
      <Rect x={42} y={69} width={18} height={2} fill="#3f2b28" />
      <Rect x={74} y={69} width={14} height={2} fill="#3f2b28" />
      <Rect x={20} y={50} width={0.8} height={14} fill="#ff5a3d" />
      <Rect x={20} y={48} width={0.8} height={18} fill="#fff7ed" opacity={0.3} />
    </>
  );
}

function renderVariant(variant: ArtworkVariant) {
  switch (variant) {
    case "fashion-red":
      return <FashionRed />;
    case "workspace":
      return <Workspace />;
    case "skincare":
      return <Skincare />;
    case "headphones":
      return <Headphones />;
    case "pancakes":
      return <Pancakes />;
    case "brunch":
      return <Brunch />;
    case "lagoon":
      return <Lagoon />;
    case "sanctuary":
      return <Sanctuary />;
    case "editorial":
      return <Editorial />;
    case "curtain":
      return <Curtain />;
    case "hero-office":
      return <HeroOffice />;
    default:
      return <Workspace />;
  }
}

export function MarkitArtwork({
  variant,
  title,
  className = "",
}: {
  variant: ArtworkVariant;
  title?: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title || variant}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {renderVariant(variant)}
    </svg>
  );
}

export default MarkitArtwork;
