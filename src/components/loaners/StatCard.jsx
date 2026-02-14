import { cn } from "@/lib/utils";

export default function StatCard({ title, value, icon: Icon, variant = "default", subtitle }) {
  const variants = {
    default: "bg-[#1A1D23] border-slate-800",
    danger: "bg-red-950/50 border-red-900/50",
    warning: "bg-amber-950/50 border-amber-900/50",
    success: "bg-emerald-950/50 border-emerald-900/50"
  };

  const iconVariants = {
    default: "bg-slate-800 text-slate-400",
    danger: "bg-red-900/30 text-red-500",
    warning: "bg-amber-900/30 text-amber-500",
    success: "bg-emerald-900/30 text-emerald-500"
  };

  const valueVariants = {
    default: "text-white",
    danger: "text-red-400",
    warning: "text-amber-400",
    success: "text-emerald-400"
  };

  return (
    <div className={cn(
      "rounded-xl border p-5 transition-all hover:shadow-md",
      variants[variant]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className={cn("text-3xl font-bold mt-1 tracking-tight", valueVariants[variant])}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn("p-2.5 rounded-lg", iconVariants[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}