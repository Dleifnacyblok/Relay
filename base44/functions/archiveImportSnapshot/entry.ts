import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Archives a snapshot of current Loaners or MissingParts to the respective snapshot entity.
 * Call with: { type: "loaners" | "missing_parts" }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { type } = body;

    if (!type || !['loaners', 'missing_parts'].includes(type)) {
      return Response.json({ error: 'type must be "loaners" or "missing_parts"' }, { status: 400 });
    }

    const importedAt = new Date().toISOString();
    const importBatchId = importedAt;

    if (type === 'loaners') {
      // Fetch all loaner records (paginate)
      const allLoaners = [];
      let skip = 0;
      const pageSize = 200;
      while (true) {
        const page = await base44.asServiceRole.entities.Loaners.list('created_date', pageSize, skip);
        if (!Array.isArray(page) || page.length === 0) break;
        allLoaners.push(...page);
        if (page.length < pageSize) break;
        skip += pageSize;
      }

      const totalOverdue = allLoaners.filter(l => l.isOverdue).length;
      const totalFines = allLoaners.reduce((sum, l) => sum + (l.fineAmount || 0), 0);

      await base44.asServiceRole.entities.LoanerImportSnapshot.create({
        importBatchId,
        importedAt,
        totalRecords: allLoaners.length,
        totalOverdue,
        totalFines,
        records: allLoaners,
      });

      return Response.json({ success: true, type: 'loaners', totalRecords: allLoaners.length, totalOverdue, totalFines });
    }

    if (type === 'missing_parts') {
      // Fetch all missing part records (paginate)
      const allParts = [];
      let skip = 0;
      const pageSize = 200;
      while (true) {
        const page = await base44.asServiceRole.entities.MissingPart.list('created_date', pageSize, skip);
        if (!Array.isArray(page) || page.length === 0) break;
        allParts.push(...page);
        if (page.length < pageSize) break;
        skip += pageSize;
      }

      const totalFines = allParts.reduce((sum, p) => sum + (p.fineAmount || 0), 0);

      await base44.asServiceRole.entities.MissingPartImportSnapshot.create({
        importBatchId,
        importedAt,
        totalRecords: allParts.length,
        totalFines,
        records: allParts,
      });

      return Response.json({ success: true, type: 'missing_parts', totalRecords: allParts.length, totalFines });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});