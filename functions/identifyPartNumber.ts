import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { imageUrl } = await req.json();
    if (!imageUrl) return Response.json({ error: 'imageUrl required' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an expert in orthopedic and medical device parts used in surgical settings (e.g. Stryker, Zimmer Biomet, DePuy Synthes, Smith & Nephew, Arthrex).

Look at this image carefully and:
1. Extract the part number — typically labeled as "REF", "Cat #", "Catalog Number", "Part #", or similar alphanumeric codes.
2. Based on the part number and any visual cues (shape, packaging, labels), identify the most likely part name/description.
3. Rate your confidence in the part name suggestion from 0 to 100.

Return a JSON object with exactly these fields:
{
  "partNumber": "the part number you see, or null if not found",
  "partName": "your best guess at the part name/description, or null if truly unknown",
  "confidence": 85,
  "reasoning": "brief explanation of why you identified it this way"
}`,
      file_urls: [imageUrl],
      response_json_schema: {
        type: "object",
        properties: {
          partNumber: { type: "string" },
          partName: { type: "string" },
          confidence: { type: "number" },
          reasoning: { type: "string" }
        }
      }
    });

    return Response.json({
      partNumber: result.partNumber || null,
      partName: result.partName || null,
      confidence: result.confidence ?? null,
      reasoning: result.reasoning || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});