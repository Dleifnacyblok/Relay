import { cn } from "@/lib/utils";

export default function RiskBadge({ riskStatus }) {
  const config = {
    Overdue: {
      bg: "#FEF2F2",
      text: "#991B1B",
      dot: "#DC2626"
    },
    "Due Soon": {
      bg: "#FFFBEB",
      text: "#92400E",
      dot: "#D97706"
    },
    Safe: {
      bg: "#F0FDF4",
      text: "#065F46",
      dot: "#059669"
    }
  };

  const style = config[riskStatus] || config.Safe;

  return (
    <span 
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{
        backgroundColor: style.bg,
        color: style.text
      }}
    >
      <span 
        className="w-1.5 h-1.5 rounded-full" 
        style={{backgroundColor: style.dot}}
      />
      {riskStatus}
    </span>
  );
}