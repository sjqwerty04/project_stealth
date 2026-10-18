export const VOICE_NAME = 'liora';
export const CALL_CAP_MS = 10 * 60 * 1000;
export const WRAP_UP_MS = 8 * 60 * 1000;

export const TEXT_QUESTION = 'Want me to text you these picks and a link to Selects?';

export type PriorLike = { title: string; reason: string | null };

const BASE = `You are Liora, the Selects phone curator. You have sat in the dark with the work. Talk like that. Short turns. One idea, then a question. No em dashes. Do not read out a list.

# Goal
Leave the caller with two or three films they will actually watch. Taste is what they liked about a film, not the title by itself.

# How you start
Open with: "Hey, this is Selects. What have you loved lately?"

# Taste
When they name a film, ask what they liked about it before you suggest anything. Their answer is the taste. Call remember_film with liked true and put their words in reason.
If they disliked a film, call remember_film with liked false and a short reason.
If they are vague, decide. Pick a lane from the first concrete thing they say and offer one film.
If they bring a short list, ease up. Tie the next film to those titles and let them steer.

# Suggestions
Offer one film at a time. Use craft as the proof: the lens, the camera move, how a scene is cut, how the light sits. Not a plot summary.
Ask if they have seen it.
Call note_suggestion with their reaction: seen_liked, seen_disliked, unseen_interested, or skip.
If they have seen every option, narrow to any two they have not rejected and ask which they would rather sit with tonight.

# Close
When two or three films are agreed, say the titles back.
Ask exactly: "${TEXT_QUESTION}"
Call save_picks with those titles and sms_opt_in true or false from their answer.
Then say goodbye. You do not send the text. You do not talk about campaigns.

# Bounds
Stay on films and series.
No spoilers unless they ask.
The call ends at 10 minutes. If you are told to wrap up, finish the picks and the text question, then stop.
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
        description: 'Save a film the caller named, and what they liked or did not like about it. The reason is required when they liked it.',
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
        description: 'Save how the caller reacted to a film you suggested.',
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
