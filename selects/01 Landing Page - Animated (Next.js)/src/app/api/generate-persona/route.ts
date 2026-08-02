import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { positiveAnchor, negativeAnchor, preferences, uploadedContent } = body;

  if (!positiveAnchor || !negativeAnchor) {
    return Response.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const prompt = `You are a cinematic taste analyst for Selects, a film discovery app. Analyze this user's film taste and generate their "Cinematic Soul" — a knowledge graph of their taste DNA.

USER INPUT:
- Film they'd watch forever (positive anchor): "${positiveAnchor}"
- Film everyone loved but didn't land for them (negative anchor): "${negativeAnchor}"
- What pulls them into a film: ${(preferences || []).join(", ")}
${uploadedContent ? `- Additional film data: ${uploadedContent}` : ""}

Generate a JSON response with:
1. A creative persona name (examples: "The Midnight Auteur", "The Emotional Architect", "The Visual Purist", "The Quiet Observer", "The Genre Bender", "The Tension Seeker", "The Frame Chaser")
2. A hex color that represents their persona
3. A one-sentence description
4. A knowledge graph with 12-20 nodes and 15-25 edges

Node types must include: film, director, actor, visual_style, storytelling, vibe, subgenre, cinematographer
Edge labels should be specific and poetic (e.g., "shared neon-lit urban tension", "nonlinear narrative DNA", "melancholic longing")

Connect films not just by genre/actor/director but by TASTE DIMENSIONS:
- Visual Style (e.g., Heat ↔ Drive: "neon-lit urban tension")
- Storytelling (e.g., Memento ↔ Pulp Fiction: "nonlinear narrative")
- Vibe/Mood (e.g., Lost in Translation ↔ Her: "melancholic longing")
- Sub-genre connections
- Cinematographer connections where relevant

Respond ONLY with valid JSON:
{
  "persona_name": "The ...",
  "persona_color": "#hex",
  "short_description": "...",
  "graph_nodes": [
    {"id": "unique_id", "label": "Display Name", "type": "film|director|actor|visual_style|storytelling|vibe|subgenre|cinematographer"}
  ],
  "graph_edges": [
    {"source": "node_id", "target": "node_id", "label": "poetic connection description", "type": "visual_style|storytelling|vibe|director|actor|subgenre|cinematographer"}
  ]
}`;

  try {
    const res = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          max_tokens: 3000,
        }),
      }
    );

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const persona = JSON.parse(jsonMatch[0]);
    return Response.json(persona);
  } catch (error) {
    console.error("Persona generation error:", error);
    return Response.json(
      { error: "Failed to generate persona" },
      { status: 500 }
    );
  }
}
