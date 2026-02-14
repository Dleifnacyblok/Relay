import { cn } from "@/lib/utils";

export default function StatCard({ title, value, icon: Icon, variant = "default", subtitle }) {
  const variants = {
    default: "bg-white border-slate-200",
    danger: "bg-red-50 border-red-200",
    warning: "bg-amber-50 border-amber-200",
    success: "bg-emerald-50 border-emerald-200"
  };

  const iconVariants = {
    default: "bg-slate-100 text-slate-600",
    danger: "bg-red-100 text-red-600",
    warning: "bg-amber-100 text-amber-600",
    success: "bg-emerald-100 text-emerald-600"
  };

  const valueVariants = {
    default: "text-slate-900",
    danger: "text-red-700",
    warning: "text-amber-700",
    success: "text-emerald-700"
  };

  return (
    <div className={cn(
      "rounded-xl border p-5 transition-all hover:shadow-md",
      variants[variant]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
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