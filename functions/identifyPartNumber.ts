import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { imageUrl } = await req.json();
    if (!imageUrl) return Response.json({ error: 'imageUrl required' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a medical device parts expert. Look at this image and extract the part number from it.
      The part number is typically a series of alphanumeric characters, often labeled as "REF", "Part #", "Cat #", "Catalog Number", or similar.
      Return ONLY the part number text you see, nothing else. If you cannot find a clear part number, return "NOT_FOUND".`,
      file_urls: [imageUrl]
    });

    const partNumber = (result || '').trim();
    return Response.json({ partNumber: partNumber === 'NOT_FOUND' ? null : partNumber });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});