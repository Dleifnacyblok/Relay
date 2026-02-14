import { cn } from "@/lib/utils";

export default function StatCard({ title, value, icon: Icon, variant = "default", subtitle }) {
  const variants = {
    default: "bg-[#121621] border-[#4F8CFF]/20",
    danger: "bg-[#121621] border-red-500/30",
    warning: "bg-[#121621] border-amber-500/30",
    success: "bg-[#121621] border-emerald-500/30"
  };

  const iconVariants = {
    default: "bg-gradient-to-br from-[#4F8CFF]/20 to-[#9D4EDD]/20 text-[#4F8CFF]",
    danger: "bg-red-950/50 text-red-500",
    warning: "bg-amber-950/50 text-amber-500",
    success: "bg-emerald-950/50 text-emerald-500"
  };

  const valueVariants = {
    default: "text-white",
    danger: "text-red-400",
    warning: "text-amber-400",
    success: "text-emerald-400"
  };

  const glowStyles = {
    default: {},
    danger: {textShadow: '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.2)'},
    warning: {textShadow: '0 0 20px rgba(245, 158, 11, 0.5), 0 0 40px rgba(245, 158, 11, 0.2)'},
    success: {}
  };

  const cardGlowStyles = {
    default: {boxShadow: '0 0 30px rgba(79, 140, 255, 0.1)'},
    danger: {boxShadow: '0 0 30px rgba(239, 68, 68, 0.15)'},
    warning: {boxShadow: '0 0 30px rgba(245, 158, 11, 0.15)'},
    success: {boxShadow: '0 0 30px rgba(16, 185, 129, 0.1)'}
  };

  return (
    <div 
      className={cn(
        "rounded-xl border p-5 transition-all",
        variants[variant]
      )}
      style={cardGlowStyles[variant]}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p 
            className={cn("text-3xl font-bold mt-1 tracking-tight", valueVariants[variant])}
            style={glowStyles[variant]}
          >
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