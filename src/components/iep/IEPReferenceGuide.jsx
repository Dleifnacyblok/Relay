import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";

const turnsData = [
  { type: "Consigned Set", expectation: "2.5 procedures / month", why: "Permanently placed — higher utilization required" },
  { type: "Loaner Set", expectation: "1 turn per Delivered Order", why: "Traveled to one case — single delivery is the full job" },
];

const tagData = [
  { system: "Altera / Caliber / Coalition / AGX RP", type: "Instrument", second: "One tag per DO only", third: "—" },
  { system: "CREO 5.5, AMP 5.5, Threaded CoCr, Threaded, DLX", type: "Implant", second: "9-17 screws: 1 implant + 1 deformity set", third: "18+ screws" },
  { system: "CREO MIS Implant", type: "Implant", second: "7-12 screws", third: "13+ screws" },
  { system: "CREO AMP Threaded MIS / MCS", type: "Instrument", second: "One tag per DO only", third: "—" },
  { system: "Coalition MIS Ti", type: "Implant", second: "4+ spacers per DO", third: "—" },
  { system: "Colonial / Colonial TPS / Hedron C", type: "Implant", second: "4+ spacers per DO", third: "—" },
  { system: "ELSA ATP / ELSA", type: "Instrument / Implant", second: "3+ spacers per DO", third: "—" },
  { system: "Sable", type: "Implant", second: "3+ spacers per DO", third: "5+ spacers" },
  { system: "Hedron IA / Independence MIS", type: "Implant", second: "2+ spacers per DO", third: "—" },
  { system: "Quartex / Revere / Revolve / RISE / RISE-L", type: "Instrument", second: "One tag per DO only", third: "—" },
  { system: "Resonate", type: "Implant", second: "2 plates", third: "—" },
  { system: "ACP / Bendini / Cohere TLIF-O / MOD-EX PL", type: "Instrument", second: "One tag per DO only", third: "—" },
  { system: "Cohere XLIF / Modulus XLIF", type: "Implant", second: "3+ spacers per DO", third: "5+ spacers" },
  { system: "CoRoent XLIF", type: "Implant", second: "One tag per DO only", third: "—" },
  { system: "Modulus ALIF", type: "Implant", second: "2+ spacers per DO", third: "N/A" },
  { system: "Modulus Cervical / TLIF-A / TLIF-O", type: "Instrument", second: "One tag per DO only", third: "—" },
  { system: "NVM5", type: "Instrument", second: "One tag per DO only", third: "—" },
  { system: "RELINE MAS", type: "Implant", second: "7-12 polyaxial screws", third: "13+ screws" },
  { system: "RELINE MAS Mod", type: "Implant", second: "7-12 shanks", third: "13+ shanks" },
  { system: "RELINE MAS Mod Reduction", type: "Implant", second: "7-12 reduction tulips", third: "13+ tulips" },
  { system: "RELINE MAS Reduction / One MAS Reduction", type: "Implant", second: "7-12 reduction screws", third: "13+ screws" },
  { system: "RELINE Open / Open Traction", type: "Implant", second: "9-17 screws", third: "18+ screws" },
  { system: "RELINE MAS Fenestrated / RELINE-C", type: "Instrument", second: "One tag per DO only", third: "—" },
  { system: "Plymouth / Simplify Cervical", type: "Instrument", second: "One tag per DO only", third: "—" },
  { system: "TLX20", type: "Implant", second: "3+ spacers per DO", third: "5+ spacers" },
  { system: "Coalition MIS", type: "Implant", second: "One tag per DO only", third: "—" },
];

const faqs = [
  {
    q: "Do I need to enter tags for non-scorecard or non-implantable sets?",
    a: "Yes — enter tags for all sets open in the sterile field. The data supports set tracking, usage trends, and annual confirm improvements.",
  },
  {
    q: "What if my case cancels or is a removal?",
    a: "The 2.5/month expectation already builds in room for cancellations and removals (backed from an optimal expectation of 4). No action needed for typical instances.",
  },
  {
    q: "My loaner set arrived late and I brought a second one — will I be penalized?",
    a: "No. Email iep@globusmedical.com and the loaner team. These are adjusted off your scorecard on a case-by-case basis.",
  },
  {
    q: "FedEx returned my set late and I now have two expected usages for one set.",
    a: "Email iep@globusmedical.com and loaner issues. Adjusted off your scorecard on a case-by-case basis.",
  },
  {
    q: "My surgeon does complex multilevel cases — can I get credit for two implant sets?",
    a: "Yes, if the Delivered Order confirms the larger implant count required both sets. See validation guidelines. The IEP Task Force also reviews these monthly.",
  },
  {
    q: "Why no extra turns for instrument-tracked sets like RISE or RISE-L in larger cases?",
    a: "Globus will consign you more implant modules as you earn them — those modules don't affect your scorecard. Loaner implant modules also don't count against you, so extra turns aren't needed.",
  },
  {
    q: "I use the ELSA Instrument set to implant RISE-L — why isn't the scorecard showing credit?",
    a: "A manual review runs each month. If the DO shows RISE-L was sold and an ELSA tag was entered without a RISE-L tag, a procedural credit is manually added to your final score.",
  },
];

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

export default function IEPReferenceGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-6 py-4 hover:bg-blue-50/50 transition-colors rounded-xl text-left"
      >
        <div className="p-2 rounded-lg bg-blue-100 shrink-0">
          <BookOpen className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">IEP Reference Guide</p>
          <p className="text-xs text-slate-400 mt-0.5">Turns expectations, tag validation rules, tracked sets & FAQs</p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-blue-100">

          {/* What is it */}
          <div className="pt-4">
            <h2 className="text-sm font-semibold text-blue-700 mb-1">What Is the IEP Scorecard?</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              The IEP Scorecard tracks how efficiently your loaner and consigned sets are being utilized. Each tracked set must generate a minimum number of procedures. Tags entered are validated against the Delivered Order to confirm implants were actually used — mirroring exactly how consignment sets are earned.
            </p>
          </div>

          {/* Turns Expectations */}
          <Section title="Turns Expectations">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-3 py-2 text-left font-medium rounded-tl-lg">Set Type</th>
                    <th className="px-3 py-2 text-left font-medium">Expectation</th>
                    <th className="px-3 py-2 text-left font-medium rounded-tr-lg">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {turnsData.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-3 py-2 font-medium text-slate-800">{row.type}</td>
                      <td className="px-3 py-2 text-slate-700">{row.expectation}</td>
                      <td className="px-3 py-2 text-slate-600">{row.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Tag Validation */}
          <Section title="Tag Validation — 2nd & 3rd Set Credit by System">
            <p className="text-xs text-slate-500 mb-3">Enter tags for all sets open in the sterile field — including non-implantable sets. Credit requires a matching Delivered Order.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-3 py-2 text-left font-medium">System</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">2nd Set Credit</th>
                    <th className="px-3 py-2 text-left font-medium">3rd Set Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tagData.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-3 py-2 font-medium text-slate-800">{row.system}</td>
                      <td className="px-3 py-2 text-slate-600">{row.type}</td>
                      <td className="px-3 py-2 text-slate-700">{row.second}</td>
                      <td className="px-3 py-2 text-slate-500">{row.third}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* FAQs */}
          <Section title="Frequently Asked Questions">
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="border border-slate-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-800 mb-1">Q{i + 1}. {faq.q}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{faq.a}</p>
                </div>
              ))}
              <p className="text-xs text-slate-400 text-center pt-1">
                Questions or adjustments: <a href="mailto:iep@globusmedical.com" className="text-blue-500 hover:underline">iep@globusmedical.com</a> · Updated March 2025
              </p>
            </div>
          </Section>

        </div>
      )}
    </div>
  );
}