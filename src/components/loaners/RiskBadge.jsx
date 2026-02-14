import { cn } from "@/lib/utils";

export default function RiskBadge({ riskStatus }) {
  const config = {
    Overdue: {
      bg: "bg-red-100",
      text: "text-red-700",
      border: "border-red-200",
      dot: "bg-red-500"
    },
    "Due Soon": {
      bg: "bg-amber-100",
      text: "text-amber-700",
      border: "border-amber-200",
      dot: "bg-amber-500"
    },
    Safe: {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500"
    }
  };

  const style = config[riskStatus] || config.Safe;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      style.bg, style.text, style.border
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
      {riskStatus}
    </span>
  );
}