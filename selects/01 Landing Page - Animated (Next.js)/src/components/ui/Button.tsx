"use client";

import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium uppercase tracking-[0.25em] transition-all duration-300 cursor-pointer";

  const variants = {
    primary: "bg-white text-black hover:bg-white/90 active:scale-[0.98]",
    ghost:
      "bg-transparent text-white border border-white/20 hover:border-white/40 hover:bg-white/5",
  };

  const sizes = {
    sm: "px-5 py-2 text-[10px] rounded-full",
    md: "px-8 py-3 text-[11px] rounded-full",
    lg: "px-10 py-4 text-[13px] rounded-full",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      style={{
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        letterSpacing: "0.25em",
      }}
      {...props}
    >
      {children}
    </button>
  );
}
