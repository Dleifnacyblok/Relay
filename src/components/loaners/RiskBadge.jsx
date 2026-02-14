import { cn } from "@/lib/utils";

export default function RiskBadge({ riskStatus }) {
  const config = {
    Overdue: {
      bg: "bg-red-950/50",
      text: "text-red-400",
      border: "border-red-900/50",
      dot: "bg-red-500"
    },
    "Due Soon": {
      bg: "bg-amber-950/50",
      text: "text-amber-400",
      border: "border-amber-900/50",
      dot: "bg-amber-500"
    },
    Safe: {
      bg: "bg-emerald-950/50",
      text: "text-emerald-400",
      border: "border-emerald-900/50",
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