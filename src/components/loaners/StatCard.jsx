import { cn } from "@/lib/utils";

export default function StatCard({ title, value, icon: Icon, variant = "default", subtitle }) {
  const variants = {
    default: "bg-white border-gray-200",
    danger: "bg-white border-red-200",
    warning: "bg-white border-amber-200",
    success: "bg-white border-emerald-200"
  };

  const iconVariants = {
    default: "bg-blue-50 text-blue-600",
    danger: "bg-red-50 text-red-600",
    warning: "bg-amber-50 text-amber-600",
    success: "bg-emerald-50 text-emerald-600"
  };

  const valueVariants = {
    default: "text-black",
    danger: "text-red-600",
    warning: "text-amber-600",
    success: "text-emerald-600"
  };

  const glowStyles = {
    default: {},
    danger: {textShadow: '0 0 15px rgba(220, 38, 38, 0.3), 0 0 30px rgba(220, 38, 38, 0.15)'},
    warning: {textShadow: '0 0 15px rgba(217, 119, 6, 0.3), 0 0 30px rgba(217, 119, 6, 0.15)'},
    success: {}
  };

  return (
    <div 
      className={cn(
        "rounded-xl border p-5 transition-all shadow-sm",
        variants[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p 
            className={cn("text-3xl font-bold mt-1 tracking-tight", valueVariants[variant])}
            style={glowStyles[variant]}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
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