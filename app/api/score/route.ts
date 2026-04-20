import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const FOOD_PROMPT = (text: string) => `You are a WW-style nutritionist scoring food items on a points system that PENALIZES added sugar and saturated fat and REWARDS protein and fiber. Vegetables are near-zero points. Fruits are low. Lean protein is moderate. Processed carbs and fatty/sugary foods score high.

Rough anchors (per typical serving):
- 1 apple: 0 pts
- Cup of plain vegetables: 0 pts
- 4oz grilled chicken breast: 3 pts
- Large salad with vinaigrette: 3-5 pts
- Slice of bread: 2 pts
- Tablespoon olive oil: 4 pts
- Cup cooked pasta, plain: 5 pts
- Slice cheese pizza: 7 pts
- Cheeseburger: 10-14 pts
- 12oz beer: 5 pts
- Glass of wine: 4 pts
- Chocolate chip cookie: 4 pts

User entered: "${text}"

Score it. If the user specified portion/size, use that. If not, assume a reasonable home portion and STATE YOUR ASSUMPTION explicitly in the note so the user can catch bad guesses.

Respond with ONLY valid JSON, no markdown, no preamble:
{"name": "cleaned up name of the food", "points": <integer>, "note": "<under 15 words. Lead with assumed portion if user didn't specify, then brief reasoning. e.g. 'assumed 2-cup salad, 1 tbsp dressing; vinegar is low-cal' or '6oz steak; lean protein, moderate fat'>"}`;

const EXERCISE_PROMPT = (text: string) => `Score exercise on a WW-style activity points system for a ~180lb adult. Be conservative — exercise points are capped at 4/day. Anchors:
- 30 min brisk walk: 2 pts
- 30 min jog: 3 pts
- 1 hour cycling moderate: 4 pts
- 45 min weight lifting: 3 pts
- 18 holes walking golf: 5 pts (will be capped at 4)
- 1 hour yoga: 2 pts
- 30 min HIIT: 4 pts

User entered: "${text}"

Respond with ONLY valid JSON:
{"name": "cleaned up activity", "points": <integer 0-6>, "note": "<under 15 words>"}`;

export async function POST(req: NextRequest) {
  try {
    const { text, kind, secret } = await req.json();
    if (secret !== process.env.APP_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!text || !kind) {
      return NextResponse.json({ error: 'missing text or kind' }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = kind === 'exercise' ? EXERCISE_PROMPT(text) : FOOD_PROMPT(text);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const textOut = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('');

    const cleaned = textOut.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error('score error', err);
    return NextResponse.json({ error: err.message || 'failed' }, { status: 500 });
  }
}
