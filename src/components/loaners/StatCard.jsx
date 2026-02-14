import { cn } from "@/lib/utils";

export default function StatCard({ title, value, icon: Icon, variant = "default", subtitle }) {
  const variants = {
    default: "bg-white",
    danger: "bg-white",
    warning: "bg-white",
    success: "bg-white"
  };

  const iconVariants = {
    default: "bg-blue-50 text-blue-600",
    danger: "bg-red-50 text-red-600",
    warning: "bg-amber-50 text-amber-600",
    success: "bg-emerald-50 text-emerald-600"
  };

  const valueVariants = {
    default: "",
    danger: "",
    warning: "",
    success: ""
  };

  const valueStyles = {
    default: {color: '#000000'},
    danger: {color: '#DC2626', textShadow: '0 0 8px rgba(220,38,38,0.25)'},
    warning: {color: '#D97706', textShadow: '0 0 20px rgba(217, 119, 6, 0.15), 0 0 40px rgba(217, 119, 6, 0.08)'},
    success: {color: '#059669'}
  };

  return (
    <div 
      className={cn(
        "rounded-xl p-5 transition-all",
        variants[variant]
      )}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #EEEEEE',
        boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.06)',
        marginBottom: '20px'
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium" style={{color: '#333333'}}>{title}</p>
          <p 
            className="text-3xl font-bold mt-1 tracking-tight"
            style={valueStyles[variant]}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs mt-1" style={{color: '#666666'}}>{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn("p-2.5 rounded-full", iconVariants[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}