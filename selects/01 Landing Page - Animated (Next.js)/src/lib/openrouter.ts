export interface PersonaResult {
  persona_name: string;
  persona_color: string;
  short_description: string;
  graph_nodes: GraphNode[];
  graph_edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  type:
    | "film"
    | "director"
    | "actor"
    | "visual_style"
    | "storytelling"
    | "vibe"
    | "subgenre"
    | "cinematographer";
  metadata?: Record<string, string>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  type: string;
}

const NODE_COLORS: Record<string, string> = {
  film: "#FFFFFF",
  director: "#CCCCCC",
  actor: "#AAAAAA",
  visual_style: "#4ECDC4",
  storytelling: "#F2C94C",
  vibe: "#9B59B6",
  subgenre: "#E74C3C",
  cinematographer: "#E87722",
};

export function getNodeColor(type: string): string {
  return NODE_COLORS[type] || "#FFFFFF";
}

export async function generatePersona(input: {
  positiveAnchor: string;
  negativeAnchor: string;
  preferences: string[];
  uploadedContent?: string;
}): Promise<PersonaResult> {
  const prompt = `You are a cinematic taste analyst for Selects, a film discovery app. Analyze this user's film taste and generate their "Cinematic Soul" — a knowledge graph of their taste DNA.

USER INPUT:
- Film they'd watch forever (positive anchor): "${input.positiveAnchor}"
- Film everyone loved but didn't land for them (negative anchor): "${input.negativeAnchor}"
- What pulls them into a film: ${input.preferences.join(", ")}
${input.uploadedContent ? `- Additional film data: ${input.uploadedContent}` : ""}

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
- Sub-genre connections (e.g., Parasite ↔ Knives Out: "class commentary thriller")
- Cinematographer connections where relevant

Respond ONLY with valid JSON in this exact format:
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

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse persona response");
  }

  return JSON.parse(jsonMatch[0]) as PersonaResult;
}
