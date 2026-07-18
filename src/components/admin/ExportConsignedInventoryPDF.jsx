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
        const colLocX = margin + 60;
        const tableWidth = pageWidth - margin * 2 - 3;

        for (const cs of consignedSets) {
          y = checkPageBreak(doc, y, 50);

          // Set name
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text((cs.setName || "Unnamed Set").substring(0, 65), colTagX, y);
          y += 5;

          // Set ID + Manufacturer
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          const metaLine = [
            cs.setId ? `Set ID: ${cs.setId}` : null,
            cs.manufacturer ? `Mfr: ${cs.manufacturer}` : null,
          ].filter(Boolean).join("   |   ");
          if (metaLine) {
            doc.text(metaLine, colTagX, y);
            y += 4.5;
          }

          // Notes
          if (cs.notes) {
            doc.setFont("helvetica", "italic");
            doc.text(`Notes: ${cs.notes}`.substring(0, 110), colTagX, y);
            y += 4.5;
          }

          y += 2;

          // Table header
          doc.setFillColor(241, 245, 249);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.3);
          doc.rect(colTagX, y - 3, tableWidth, 7, "FD");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text("TAG #", colTagX + 2, y + 1.5);
          doc.text("LOCATION / HOME ACCOUNT", colLocX + 2, y + 1.5);
          y += 7;

          // Table rows
          const tags = cs.tagNumbers || [];
          const homeAccounts = cs.homeAccounts || [];

          if (tags.length === 0) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("No tags assigned", colTagX + 2, y + 4);
            y += 8;
          } else {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            for (let i = 0; i < tags.length; i++) {
              y = checkPageBreak(doc, y, 14);
              const rowBg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
              doc.setFillColor(...rowBg);
              doc.rect(colTagX, y - 3, tableWidth, 6, "F");
              doc.setTextColor(15, 23, 42);
              doc.text(String(tags[i] || "").substring(0, 25), colTagX + 2, y + 1);
              doc.setTextColor(51, 65, 85);
              doc.text(String(homeAccounts[i] || "—").substring(0, 45), colLocX + 2, y + 1);
              y += 6;
            }
          }

          y += 4;
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.5);
          doc.line(colTagX, y, pageWidth - margin, y);
          y += 6;
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