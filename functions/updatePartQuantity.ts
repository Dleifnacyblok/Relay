import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { trackingNumber, partName, newQuantity } = await req.json();

    // Find the send back log entry
    const logs = await base44.entities.SendBackLog.filter({ trackingNumber });
    if (logs.length === 0) {
      return Response.json({ error: 'Log entry not found' }, { status: 404 });
    }

    const log = logs[0];
    
    // Find the missing part by name from the part IDs in the log
    const allParts = await base44.entities.MissingPart.list();
    const part = allParts.find(p => 
      log.missingPartIds?.includes(p.id) && 
      p.partName.toLowerCase().includes(partName.toLowerCase())
    );

    if (!part) {
      return Response.json({ error: 'Part not found in this shipment' }, { status: 404 });
    }

    // Update the quantity
    await base44.entities.MissingPart.update(part.id, {
      missingQuantity: newQuantity
    });

    return Response.json({
      success: true,
      message: `Updated ${partName} quantity to ${newQuantity}`,
      partId: part.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});