import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDoc, addReportHeader, addFooters, checkPageBreak, getNow, getFilename } from "@/lib/pdfUtils";

export default function ExportConsignedInventoryPDF({ consignedSets }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const totalTags = consignedSets.reduce((sum, cs) => sum + (cs.tagNumbers || []).length, 0);
        const { doc, pageWidth, margin } = createDoc();
        let y = addReportHeader(doc, {
          pageWidth,
          margin,
          title: "Consignment Inventory Report",
          subtitle: "Relay Loaner Manager",
          generated: getNow(),
          total: `${consignedSets.length} set${consignedSets.length !== 1 ? "s" : ""}  |  ${totalTags} tag${totalTags !== 1 ? "s" : ""}`,
          totalCount: consignedSets.length,
        });

        const colTagX = margin + 3;
        const colLocX = margin + 55;
        const tableWidth = pageWidth - margin * 2 - 3;

        // Group sets by manufacturer, Globus first then Nuvasive
        const mfrOrder = ["Globus", "Nuvasive"];
        const grouped = {};
        for (const cs of consignedSets) {
          const mfr = cs.manufacturer || "Other";
          if (!grouped[mfr]) grouped[mfr] = [];
          grouped[mfr].push(cs);
        }
        const mfrKeys = [...mfrOrder.filter((m) => grouped[m]), ...Object.keys(grouped).filter((m) => !mfrOrder.includes(m))];

        let isFirstMfr = true;
        for (const mfr of mfrKeys) {
          const sets = grouped[mfr];
          const mfrTagCount = sets.reduce((s, cs) => s + (cs.tagNumbers || []).length, 0);

          if (!isFirstMfr) {
            doc.addPage();
            y = 20;
          }

          // Manufacturer section header
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text(mfr, colTagX, y);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text(`${sets.length} set${sets.length !== 1 ? "s" : ""}  |  ${mfrTagCount} tag${mfrTagCount !== 1 ? "s" : ""}`, pageWidth - margin, y, { align: "right" });
          y += 5;

          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.5);
          doc.line(colTagX, y, pageWidth - margin, y);
          y += 5;

          for (const cs of sets) {
            y = checkPageBreak(doc, y, 270);

            // Set name + Set ID on one line
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text((cs.setName || "Unnamed Set").substring(0, 55), colTagX, y);
            if (cs.setId) {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(7.5);
              doc.setTextColor(148, 163, 184);
              doc.text(cs.setId, pageWidth - margin, y, { align: "right" });
            }
            y += 3.5;

            // Notes (if any)
            if (cs.notes) {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text(`Notes: ${cs.notes}`.substring(0, 120), colTagX, y);
              y += 3;
            }

            // Table header
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.2);
            doc.rect(colTagX, y - 2.5, tableWidth, 5, "FD");
            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);
            doc.setTextColor(71, 85, 105);
            doc.text("TAG #", colTagX + 2, y + 0.5);
            doc.text("LOCATION / HOME ACCOUNT", colLocX + 2, y + 0.5);
            y += 5;

            // Table rows
            const tags = cs.tagNumbers || [];
            const homeAccounts = cs.homeAccounts || [];

            if (tags.length === 0) {
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7);
              doc.setTextColor(148, 163, 184);
              doc.text("No tags assigned", colTagX + 2, y + 2.5);
              y += 5;
            } else {
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
              for (let i = 0; i < tags.length; i++) {
                y = checkPageBreak(doc, y, 270);
                const rowBg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
                doc.setFillColor(...rowBg);
                doc.rect(colTagX, y - 2.5, tableWidth, 4.5, "F");
                doc.setTextColor(15, 23, 42);
                doc.text(String(tags[i] || "").substring(0, 28), colTagX + 2, y + 0.5);
                doc.setTextColor(51, 65, 85);
                doc.text(String(homeAccounts[i] || "—").substring(0, 50), colLocX + 2, y + 0.5);
                y += 4.5;
              }
            }

            y += 3;
          }

          isFirstMfr = false;
        }

        addFooters(doc);
        doc.save(getFilename("consignment-inventory"));
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  return (
    <Button
      onClick={handleGenerate}
      disabled={isGenerating || consignedSets.length === 0}
      variant="outline"
      className="min-h-[44px] whitespace-nowrap"
    >
      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
      Export PDF
    </Button>
  );
}