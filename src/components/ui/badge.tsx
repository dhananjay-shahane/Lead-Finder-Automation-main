import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "hot" | "warm" | "cold" | "success" | "warning" | "danger" | "default" | "indigo";
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const variantStyles = {
    hot: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    warm: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    cold: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    default: "bg-slate-800 text-slate-300 border-slate-700",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}

export default Badge;
