import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, RefreshCw, AlertTriangle, Clock, DollarSign, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { computeLoanerData } from "@/components/loaners/loanerUtils";

const QUICK_PROMPTS = [
  "What are my overdue sets right now?",
  "How much am I being fined total?",
  "Which sets are due in the next 7 days?",
  "How do I send a loaner back?",
  "What happens if I go overdue?",
  "How do I transfer a loaner to another rep?",
  "Summarize my missing parts",
  "What should I do first today?",
];

function GregAvatar() {
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
      <span className="text-white text-sm font-bold">G</span>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <GregAvatar />}
      <div className={cn(
        "max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-slate-800 text-white rounded-br-sm"
          : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
      )}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown
            className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            components={{
              p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="my-0.5">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{children}</a>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium", color)}>
      <Icon className="w-3.5 h-3.5" />
      <span>{value} {label}</span>
    </div>
  );
}

export default function RelayGuide() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [welcomed, setWelcomed] = useState(false);
  const bottomRef = useRef(null);

  const { data: user } = useQuery({ queryKey: ["currentUser"], queryFn: () => base44.auth.me() });
  const { data: loaners = [] } = useQuery({ queryKey: ["loaners"], queryFn: () => base44.entities.Loaners.list() });
  const { data: missingParts = [] } = useQuery({ queryKey: ["missingParts"], queryFn: () => base44.entities.MissingPart.list() });

  const userName = user?.full_name || "";
  const firstName = userName.split(" ")[0] || "there";

  const computedLoaners = loaners.map(computeLoanerData);
  const myLoaners = computedLoaners.filter(l =>
    l.returnStatus !== "sent_back" && l.returnStatus !== "received" &&
    (l.repName?.toLowerCase() === userName.toLowerCase() ||
     l.associateSalesRep?.toLowerCase() === userName.toLowerCase() ||
     l.fieldSalesRep?.toLowerCase() === userName.toLowerCase())
  );
  const myOverdue = myLoaners.filter(l => l.isOverdue);
  const myDueSoon = myLoaners.filter(l => !l.isOverdue && l.daysUntilDue >= 0 && l.daysUntilDue <= 7);
  const myFines = myLoaners.reduce((s, l) => s + (l.fineAmount || 0), 0);
  const myMissingParts = missingParts.filter(p =>
    p.repName?.toLowerCase() === userName.toLowerCase() &&
    p.status === "missing" &&
    p.returnStatus !== "sent_back" && p.returnStatus !== "received"
  );
  const myMissingFines = myMissingParts.reduce((s, p) => s + (p.fineAmount || 0), 0);

  const buildLoanerContext = () => {
    const lines = [`User: ${userName}`, `My Loaners: ${myLoaners.length} total`];
    if (myOverdue.length) {
      lines.push(`Overdue sets (${myOverdue.length}):`);
      myOverdue.forEach(l => lines.push(`  - ${l.setName} | Etch: ${l.etchId} | ${l.daysOverdue}d overdue | Fine: $${(l.fineAmount||0).toLocaleString()} | Account: ${l.accountName}`));
    }
    if (myDueSoon.length) {
      lines.push(`Due soon (${myDueSoon.length}):`);
      myDueSoon.forEach(l => lines.push(`  - ${l.setName} | Due: ${l.expectedReturnDate} | ${l.daysUntilDue}d left`));
    }
    if (myFines > 0) lines.push(`Total loaner fines: $${myFines.toLocaleString()}`);
    if (myMissingParts.length) {
      lines.push(`Missing parts (${myMissingParts.length}):`);
      myMissingParts.forEach(p => lines.push(`  - ${p.partName} | Part#: ${p.partNumber || 'N/A'} | Fine: $${(p.fineAmount||0).toLocaleString()}`));
      if (myMissingFines > 0) lines.push(`Total missing parts fines: $${myMissingFines.toLocaleString()}`);
    }
    return lines.join("\n");
  };

  const buildWelcomeMessage = () => {
    const parts = [`Hey ${firstName}! 👋 I'm **Greg**, your Relay assistant. I've pulled up your live data — here's a quick snapshot:\n`];
    parts.push(`**📦 Your Loaners:** ${myLoaners.length} active set${myLoaners.length !== 1 ? "s" : ""}`);
    if (myOverdue.length) parts.push(`**🔴 Overdue:** ${myOverdue.length} set${myOverdue.length !== 1 ? "s" : ""} — fine exposure $${myFines.toLocaleString()}`);
    if (myDueSoon.length) parts.push(`**🟡 Due Soon:** ${myDueSoon.length} set${myDueSoon.length !== 1 ? "s" : ""} due in the next 7 days`);
    if (myMissingParts.length) parts.push(`**⚠️ Missing Parts:** ${myMissingParts.length} part${myMissingParts.length !== 1 ? "s" : ""} — fines $${myMissingFines.toLocaleString()}`);
    if (!myOverdue.length && !myMissingParts.length) parts.push(`**✅ All clear!** No overdue sets or missing parts — nice work.`);
    parts.push(`\nWhat can I help you with today?`);
    return parts.join("\n");
  };

  useEffect(() => {
    if (!welcomed && userName && loaners.length > 0) {
      setWelcomed(true);
      setMessages([{ role: "assistant", content: buildWelcomeMessage() }]);
    }
  }, [userName, loaners]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const sendMessage = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isSending) return;
    setInput("");
    setIsSending(true);

    const newMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);

    const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
    const response = await base44.functions.invoke("gregChat", {
      messages: apiMessages,
      loanerContext: buildLoanerContext(),
    });

    setMessages(prev => [...prev, { role: "assistant", content: response.data.content }]);
    setIsSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const resetChat = () => {
    setWelcomed(false);
    setMessages([]);
    setTimeout(() => {
      setWelcomed(true);
      setMessages([{ role: "assistant", content: buildWelcomeMessage() }]);
    }, 100);
  };

  const showQuickPrompts = messages.length <= 1 && !isSending;

  return (
    <div className="flex flex-col bg-slate-50" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <GregAvatar />
          <div>
            <h1 className="text-base font-semibold text-slate-900">Greg</h1>
            <p className="text-xs text-slate-500">Your Relay AI assistant</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={resetChat} className="gap-1.5 text-slate-500">
          <RefreshCw className="w-3.5 h-3.5" />
          Reset
        </Button>
      </div>

      {/* Live Stats Bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide">
        <StatPill icon={Package} label="My Sets" value={myLoaners.length} color="bg-slate-100 text-slate-700" />
        {myOverdue.length > 0 && <StatPill icon={AlertTriangle} label="Overdue" value={myOverdue.length} color="bg-red-50 text-red-700" />}
        {myDueSoon.length > 0 && <StatPill icon={Clock} label="Due Soon" value={myDueSoon.length} color="bg-amber-50 text-amber-700" />}
        {myFines > 0 && <StatPill icon={DollarSign} label="Fines" value={`$${myFines.toLocaleString()}`} color="bg-orange-50 text-orange-700" />}
        {myMissingParts.length > 0 && <StatPill icon={AlertTriangle} label="Missing Parts" value={myMissingParts.length} color="bg-purple-50 text-purple-700" />}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
        {isSending && (
          <div className="flex gap-3 mb-4">
            <GregAvatar />
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Prompts */}
      {showQuickPrompts && (
        <div className="px-4 pb-2 shrink-0">
          <p className="text-xs text-slate-400 mb-2 font-medium">Quick questions</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Greg anything..."
            className="flex-1"
            disabled={isSending}
          />
          <Button onClick={() => sendMessage()} disabled={!input.trim() || isSending} size="icon">
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}