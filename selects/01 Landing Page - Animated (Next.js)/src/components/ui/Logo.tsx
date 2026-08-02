"use client";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "transparent";
}

export default function Logo({
  className = "",
  size = "md",
  variant = "solid",
}: LogoProps) {
  const sizes = {
    sm: { icon: 24, text: "text-xs", gap: "gap-2", tracking: "tracking-[0.3em]" },
    md: { icon: 32, text: "text-sm", gap: "gap-3", tracking: "tracking-[0.35em]" },
    lg: { icon: 48, text: "text-xl", gap: "gap-4", tracking: "tracking-[0.4em]" },
  };

  const s = sizes[size];
  const isTransparent = variant === "transparent";
  const iconFill = isTransparent ? "none" : "white";
  const iconStroke = isTransparent ? "currentColor" : "none";
  const iconStrokeWidth = isTransparent ? 1.5 : 0;

  return (
    <div
      className={`flex items-center ${s.gap} ${
        isTransparent ? "text-white/40" : "text-white"
      } ${className}`}
    >
      {/* Film frame icon */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top sprocket bar */}
        <rect
          x="4"
          y="2"
          width="40"
          height="3"
          rx="0.5"
          fill={iconFill}
          stroke={iconStroke}
          strokeWidth={iconStrokeWidth}
        />
        {/* Bottom sprocket bar */}
        <rect
          x="4"
          y="43"
          width="40"
          height="3"
          rx="0.5"
          fill={iconFill}
          stroke={iconStroke}
          strokeWidth={iconStrokeWidth}
        />
        {/* Left sprocket holes */}
        <rect
          x="4"
          y="8"
          width="6"
          height="12"
          rx="1"
          fill={iconFill}
          stroke={iconStroke}
          strokeWidth={iconStrokeWidth}
        />
        <rect
          x="4"
          y="28"
          width="6"
          height="12"
          rx="1"
          fill={iconFill}
          stroke={iconStroke}
          strokeWidth={iconStrokeWidth}
        />
        {/* Right sprocket holes */}
        <rect
          x="38"
          y="8"
          width="6"
          height="12"
          rx="1"
          fill={iconFill}
          stroke={iconStroke}
          strokeWidth={iconStrokeWidth}
        />
        <rect
          x="38"
          y="28"
          width="6"
          height="12"
          rx="1"
          fill={iconFill}
          stroke={iconStroke}
          strokeWidth={iconStrokeWidth}
        />
        {/* Center frame */}
        <rect
          x="13"
          y="8"
          width="22"
          height="32"
          rx="1.5"
          fill={iconFill}
          stroke={iconStroke}
          strokeWidth={iconStrokeWidth}
        />
      </svg>
      {/* Text */}
      <span
        className={`${s.text} ${s.tracking} font-medium uppercase ${
          isTransparent ? "text-white/40" : "text-white"
        }`}
        style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}
      >
        Selects
      </span>
    </div>
  );
}
