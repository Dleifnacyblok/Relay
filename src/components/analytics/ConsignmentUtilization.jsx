import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { computeLoanerData } from "@/components/loaners/loanerUtils";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { MapPin, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { useMemo } from "react";

// Normalize set names for matching: uppercase, strip extra spaces
const normalize = (s) => (s || "").toUpperCase().trim();

export default function ConsignmentUtilization({ computed }) {
  const { data: consignedSets = [] } = useQuery({
    queryKey: ["consignedSets"],
    queryFn: () => base44.entities.ConsignedSet.list()
  });

  // Active loaners only (not returned)
  const activeLoaners = useMemo(() =>
  computed.filter((l) => l.returnStatus !== "sent_back" && l.returnStatus !== "received"),
  [computed]
  );

  // Build a map: normalizedSetName → consigned set
  const consignedByName = useMemo(() => {
    const map = {};
    consignedSets.forEach((cs) => {
      map[normalize(cs.setName)] = cs;
    });
    return map;
  }, [consignedSets]);

  // For each active loaner, check if its setName matches a consigned set
  const matched = useMemo(() =>
  activeLoaners.filter((l) => consignedByName[normalize(l.setName)]),
  [activeLoaners, consignedByName]
  );

  // Aggregate per set: how many active loaners per consigned set name
  const utilizationMap = useMemo(() => {
    const map = {};
    matched.forEach((l) => {
      const key = normalize(l.setName);
      const cs = consignedByName[key];
      if (!map[key]) {
        map[key] = {
          setName: cs.setName,
          manufacturer: cs.manufacturer || "",
          totalTags: (cs.tagNumbers || []).length,
          activeLoaners: 0,
          overdueCount: 0,
          accounts: new Set(),
          homeAccounts: cs.homeAccounts || [],
          tagNumbers: cs.tagNumbers || []
        };
      }
      map[key].activeLoaners++;
      if (l.risk_status === "Overdue") map[key].overdueCount++;
      if (l.accountName) map[key].accounts.add(l.accountName);
    });
    return map;
  }, [matched, consignedByName]);

  const utilizationData = useMemo(() =>
  Object.values(utilizationMap).
  map((d) => ({
    ...d,
    accountCount: d.accounts.size,
    utilizationRate: d.totalTags > 0 ? Math.round(d.activeLoaners / d.totalTags * 100) : 0,
    accounts: Array.from(d.accounts),
    label: d.setName.length > 22 ? d.setName.slice(0, 22) + "…" : d.setName
  })).
  sort((a, b) => b.activeLoaners - a.activeLoaners),
  [utilizationMap]
  );

  // Displaced = loaner's account is NOT one of the home accounts for that set
  const displaced = useMemo(() =>
  matched.filter((l) => {
    const cs = consignedByName[normalize(l.setName)];
    const homes = (cs.homeAccounts || []).map((h) => normalize(h)).filter(Boolean);
    if (homes.length === 0) return false; // no home account defined, skip
    return !homes.includes(normalize(l.accountName));
  }),
  [matched, consignedByName]
  );

  const displacedBySet = useMemo(() => {
    const map = {};
    displaced.forEach((l) => {
      const key = normalize(l.setName);
      if (!map[key]) map[key] = { setName: l.setName, items: [] };
      map[key].items.push(l);
    });
    return Object.values(map).sort((a, b) => b.items.length - a.items.length);
  }, [displaced]);

  const totalConsigned = consignedSets.reduce((s, cs) => s + (cs.tagNumbers || []).length, 0);
  const matchedSetCount = utilizationData.length;
  const displacedCount = displaced.length;

  return (
    <div>
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        



        
        



        
        





        
      </div>

      {/* Bar chart: active loaners per consigned set */}
      {utilizationData.length > 0 &&
      <Card className="p-5 bg-white border-slate-200 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Active Loaners per Consigned Set</h3>
          <p className="text-xs text-slate-400 mb-4">How many tags from each territory set are currently out on loan</p>
          <ResponsiveContainer width="100%" height={Math.max(200, utilizationData.length * 36)}>
            <BarChart data={utilizationData} layout="vertical" barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={150} />
              <Tooltip
              formatter={(v, name) => [v, name]}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow text-xs">
                      <p className="font-semibold text-slate-800 mb-1">{d.setName}</p>
                      <p className="text-blue-600">{d.activeLoaners} active loaner{d.activeLoaners !== 1 ? "s" : ""}</p>
                      {d.totalTags > 0 && <p className="text-slate-500">{d.utilizationRate}% of {d.totalTags} tags out</p>}
                      {d.overdueCount > 0 && <p className="text-red-600">{d.overdueCount} overdue</p>}
                      {d.accountCount > 0 && <p className="text-slate-400 mt-1">At: {d.accounts.slice(0, 3).join(", ")}{d.accounts.length > 3 ? "…" : ""}</p>}
                    </div>);

              }} />
            
              <Bar dataKey="activeLoaners" radius={[0, 4, 4, 0]} name="Active Loaners">
                {utilizationData.map((d, i) =>
              <Cell key={i} fill={d.overdueCount > 0 ? "#ef4444" : d.utilizationRate > 50 ? "#f59e0b" : "#3b82f6"} />
              )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Normal</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> &gt;50% out</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Has overdue</span>
          </div>
        </Card>
      }

      {/* Displaced sets table */}
      {displacedBySet.length > 0 &&
      <Card className="p-5 bg-white border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Displaced Consigned Sets
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Tags loaned to an account other than their designated home account
          </p>
          <div className="space-y-3">
            {displacedBySet.map((d, i) => {
            const cs = consignedByName[normalize(d.setName)];
            return (
              <div key={i} className="border border-slate-100 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-800">{d.setName}</span>
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                      {d.items.length} displaced
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {d.items.map((l, j) => {
                    const tagIdx = (cs?.tagNumbers || []).findIndex((t) => normalize(t) === normalize(l.etchId));
                    const homeAcct = tagIdx >= 0 ? (cs?.homeAccounts || [])[tagIdx] : null;
                    return (
                      <div key={j} className="flex flex-wrap items-center justify-between px-4 py-2 gap-2 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-slate-500">{l.etchId || "—"}</span>
                            <span className="text-slate-700 font-medium">@ {l.accountName}</span>
                            {l.repName && <span className="text-slate-400">· {l.repName}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {homeAcct &&
                          <span className="text-slate-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> home: {homeAcct}
                              </span>
                          }
                            {l.risk_status === "Overdue" ?
                          <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full font-semibold">Overdue</span> :
                          l.risk_status === "Due Soon" ?
                          <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full font-semibold">Due Soon</span> :

                          <span className="text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">Active</span>
                          }
                          </div>
                        </div>);

                  })}
                  </div>
                </div>);

          })}
          </div>
        </Card>
      }

      {utilizationData.length === 0 &&
      <Card className="p-8 text-center bg-white border-slate-200">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No active loaners match consigned territory sets.</p>
        </Card>
      }
    </div>);

}