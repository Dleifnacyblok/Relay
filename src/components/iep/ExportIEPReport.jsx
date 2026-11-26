import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import IEPExportPDF from "@/components/iep/IEPExportPDF";

export default function ExportIEPReport() {
  const { data: systems = [] } = useQuery({
    queryKey: ["iepSystemData"],
    queryFn: () => base44.entities.IEPSystemData.list(),
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ["iepImportSnapshots"],
    queryFn: async () => {
      const res = await base44.entities.IEPImportSnapshot.filter({}, { sort: "-importedAt", limit: 24 });
      return res?.items || [];
    },
  });

  const withTotals = systems.filter((s) => s.procCmpl != null && s.totalExpUsage != null);
  const totalUsage = withTotals.reduce((a, s) => a + s.totalExpUsage, 0);
  const avgEffPct =
    totalUsage > 0
      ? (withTotals.reduce((a, s) => a + s.procCmpl, 0) / totalUsage) * 100
      : null;

  const dates = systems.filter((s) => s.importedAt).map((s) => new Date(s.importedAt));
  const lastImport = dates.length ? new Date(Math.max(...dates)) : null;

  return <IEPExportPDF systems={systems} avgEffPct={avgEffPct} lastImport={lastImport} snapshots={snapshots} />;
}