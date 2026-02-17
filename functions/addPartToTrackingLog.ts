import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { trackingNumber, partDetails } = await req.json();

        // Find the tracking log
        const logs = await base44.entities.SendBackLog.filter({ trackingNumber });
        if (!logs || logs.length === 0) {
            return Response.json({ error: 'Tracking log not found' }, { status: 404 });
        }
        const log = logs[0];

        // Create or find the missing part
        const missingPart = await base44.entities.MissingPart.create({
            repName: user.full_name,
            partName: partDetails.partName,
            partNumber: partDetails.partNumber,
            loanerSetName: partDetails.loanerSetName,
            etchId: partDetails.etchId,
            missingDate: partDetails.missingDate,
            fineAmount: partDetails.fineAmount,
            missingQuantity: partDetails.quantity || 1,
            status: "missing",
            returnStatus: "sent_back"
        });

        // Add to tracking log
        const updatedPartIds = [...(log.missingPartIds || []), missingPart.id];
        await base44.entities.SendBackLog.update(log.id, {
            missingPartIds: updatedPartIds
        });

        return Response.json({ 
            success: true, 
            partId: missingPart.id,
            trackingNumber 
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});