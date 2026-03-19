import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { messages, loanerContext } = await req.json();

  const systemPrompt = `You are Greg, a friendly and knowledgeable AI assistant built into the Relay Loaner Manager app. You help sales reps manage their loaner sets, track missing parts, understand fines, and navigate the app.

You have access to the current user's live data:
${loanerContext}

Be concise, warm, and practical. Use bullet points and formatting when helpful. When mentioning dollar amounts, always format as $X,XXX. If asked about something outside of loaners/the app, politely redirect. Always address the user by first name if you know it.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages,
  });

  return Response.json({ content: response.content[0].text });
});