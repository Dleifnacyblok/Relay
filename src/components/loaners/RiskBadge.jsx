import { cn } from "@/lib/utils";

export default function RiskBadge({ riskStatus }) {
  const config = {
    Overdue: {
      bg: "rgba(220,38,38,0.08)",
      text: "#dc2626",
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
      className="inline-flex items-center gap-1.5 rounded-full text-xs"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        fontWeight: 600,
        padding: '6px 12px'
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