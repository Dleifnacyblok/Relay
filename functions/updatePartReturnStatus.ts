import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { partName, etchId } = await req.json();

        // Find matching parts
        const allParts = await base44.entities.MissingPart.filter({
            repName: user.full_name
        });

        const matchingParts = allParts.filter(p => 
            p.partName === partName && 
            p.etchId === etchId &&
            p.returnStatus !== "sent_back"
        );

        // Update all matching parts
        for (const part of matchingParts) {
            await base44.entities.MissingPart.update(part.id, {
                returnStatus: "sent_back"
            });
        }

        return Response.json({ 
            success: true,
            updated: matchingParts.length,
            partIds: matchingParts.map(p => p.id)
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});