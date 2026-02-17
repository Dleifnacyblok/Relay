import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all missing parts with $0 fees
    const allParts = await base44.asServiceRole.entities.MissingPart.list();
    const zeroFeeParts = allParts.filter(part => !part.fineAmount || part.fineAmount === 0);

    // Delete them
    const deletePromises = zeroFeeParts.map(part => 
      base44.asServiceRole.entities.MissingPart.delete(part.id)
    );
    
    await Promise.all(deletePromises);

    return Response.json({
      success: true,
      deleted: zeroFeeParts.length,
      message: `Deleted ${zeroFeeParts.length} missing parts with $0 fees`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});