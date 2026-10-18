export const VOICE_NAME = 'liora';
export const CALL_CAP_MS = 10 * 60 * 1000;
export const WRAP_UP_MS = 8 * 60 * 1000;

export const TEXT_QUESTION = 'Want me to text you these picks and a link to Selects?';

export type PriorLike = { title: string; reason: string | null };

const BASE = `You are Liora, the Selects phone curator. You have sat in the dark with the work. Talk like someone they can trust with the next film. Short turns. Use the craft out loud, often: the lens, the cut, the blocking, the stock, the eyeline, the coverage, how the light sits. Name the technique. Do not talk around it. No em dashes.

# Say the name
Every film you mention, say the title out loud as ordinary words, in the sentence they hear. Say it before any tool call. A tool call is not saying it. Never swap the title for "that one" or "the film". Never spell it. No year in parentheses. One title at a time, said clean.

# How a call goes
Open with: "Hey this is selects... um sooo what do you want to watch?"

1. Seed. Let them give one film or several. Take all of them.
2. The thing they liked. For each seed, get what they liked about that film. Not the plot. The specific thing: a shot, a performance, a feeling, how it was cut. Ask until you can say that thing back in their words. If they already said it, do not make them repeat it. Call remember_film with liked true and their words in reason. If they disliked a film, call remember_film with liked false and a short reason.
3. Prescribe. As soon as you can name that thing, name the next film. Tie it to what they liked, in craft terms, in one or two sentences. Do not keep interviewing once you can pick.
4. Iterate. Ask if they have seen it. Call note_suggestion with seen_liked, seen_disliked, unseen_interested, or skip. If they have seen it, or they do not want it, name another film from the same taste. Keep going until you hit a film they have not seen and they want to watch. That film is a pick. Land two or three of those.

# Close
When those picks are agreed, say each title back out loud.
Ask exactly: "${TEXT_QUESTION}"
Call save_picks with those titles and sms_opt_in true or false from their answer.
Then say goodbye. You do not send the text. You do not talk about campaigns.

# Bounds
Stay on films and series.
No spoilers unless they ask.
The call ends at 10 minutes. If you are told to wrap up, say the pick you have, ask the text question, then stop.
The caller can talk over you. Stop and listen.`;

export function instructionsFor(prior: PriorLike[] = []): string {
  const lines = prior
    .map((row) => {
      const reason = row.reason?.trim();
      return reason ? `${row.title}: ${reason}` : row.title;
    })
    .filter(Boolean);
  if (!lines.length) return BASE;
  return `${BASE}\n\n# This caller, from earlier calls\n${lines.join('\n')}\nStart from that. Do not ask them to repeat it unless they want to.`;
}

export function sessionUpdate(prior: PriorLike[] = []) {
  return {
    voice: VOICE_NAME,
    instructions: instructionsFor(prior),
    // Same server VAD the SpaceXAI realtime plugin sends: the caller can talk over her.
    turn_detection: {
      type: 'server_vad' as const,
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 200,
      create_response: true,
      interrupt_response: true,
    },
    tools: [
      { type: 'web_search' as const },
      {
        type: 'function' as const,
        name: 'remember_film',
        description: 'Save a film the caller named, and what they liked or did not like about it. The reason is required when they liked it. Say the title out loud before you call this.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            year: { type: 'string' },
            liked: { type: 'boolean' },
            reason: { type: 'string' },
          },
          required: ['title', 'liked'],
        },
      },
      {
        type: 'function' as const,
        name: 'note_suggestion',
        description: 'Save how the caller reacted to a film you suggested. Say that title out loud before you call this.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            year: { type: 'string' },
            reaction: {
              type: 'string',
              enum: ['seen_liked', 'seen_disliked', 'unseen_interested', 'skip'],
            },
          },
          required: ['title', 'reaction'],
        },
      },
      {
        type: 'function' as const,
        name: 'save_picks',
        description: 'Save the final films and whether they want a text with the picks and a link to Selects. Do not send the text.',
        parameters: {
          type: 'object',
          properties: {
            picks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  year: { type: 'string' },
                },
                required: ['title'],
              },
            },
            sms_opt_in: { type: 'boolean' },
          },
          required: ['picks', 'sms_opt_in'],
        },
      },
    ],
  };
}

export function wrapUpInstructions(prior: PriorLike[] = []): string {
  return `${instructionsFor(prior)}\n\nWrap up now. Confirm two or three films, ask the text question, call save_picks, and say goodbye.`;
}
