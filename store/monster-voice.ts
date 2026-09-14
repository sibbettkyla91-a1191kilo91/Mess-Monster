import { MonsterId } from "./monster-id";
import { EvolutionStage } from "./types";
import { PetMood } from "./use-pet-store";

/**
 * Talk-back: the short line the monster says under its sprite.
 *
 * Pure module — no store reads, no timers, no side effects. Home decides
 * when to ask for a line (idle rotation, right after a care action, on a
 * welcome-back) and passes the context in. Both voices stay warm and
 * pressure-free: nothing here comments on chores, tidiness, or how long the
 * player was away. A low mood gets gentle company, never a guilt trip.
 */

export type TimeOfDay = "morning" | "afternoon" | "evening" | "late";
export type VoiceMood = "thriving" | "happy" | "neutral" | "low";
export type LastAction = "feed" | "play" | "pet" | "welcome" | null;

export type VoiceContext = {
  mood: PetMood;
  timeOfDay: TimeOfDay;
  lastAction: LastAction;
  stage?: EvolutionStage;
};

export type VoicePools = {
  general: readonly string[];
  mood: Record<VoiceMood, readonly string[]>;
  time: Record<TimeOfDay, readonly string[]>;
  feed: readonly string[];
  play: readonly string[];
  pet: readonly string[];
  welcome: readonly string[];
};

export const VOICE_LINES: Record<MonsterId, VoicePools> = {
  nilly: {
    general: [
      "Hi hi! I saved you a sunbeam.",
      "I practiced a new wiggle. Did you see it? Did you?",
      "Your face is my favorite face.",
      "I counted the sparkles. There are lots.",
    ],
    mood: {
      thriving: [
        "I feel fizzy today. Good fizzy!",
        "Everything is shiny and so am I.",
      ],
      happy: [
        "This is a cozy kind of day.",
        "I'm humming. Can you hear it? It's tiny.",
      ],
      neutral: [
        "Just floating here, thinking about you.",
        "Sit with me a sec? No reason.",
      ],
      low: [
        "Hi. I'm glad it's you.",
        "Small day. Still nice that you're here.",
      ],
    },
    time: {
      morning: [
        "Morning! The light is doing the soft thing.",
        "I woke up and remembered you. Good start.",
      ],
      afternoon: [
        "Snack o'clock? Asking for a friend. The friend is me.",
        "Afternoon stretch! Wiggle wiggle.",
      ],
      evening: [
        "The sky went peach. I saved you some.",
        "Evening is my favorite. You're in it.",
      ],
      late: [
        "Shh… the stars are being loud tonight.",
        "Late-night club: you and me. Very exclusive.",
      ],
    },
    feed: ["Yum! Thank you.", "That snack had a whole personality."],
    play: ["This is so fun!", "Again! Okay, again again!"],
    pet: [
      "Hehe — that tickles!",
      "Oh! Okay. Yes. More of that.",
      "I melted a little. It's fine.",
    ],
    welcome: [
      "You're back! I did a happy spin.",
      "Hi hi! I kept your spot warm.",
      "There you are. My favorite arrival.",
    ],
  },
  luna: {
    general: [
      "The candles like you. So do I, marginally.",
      "I was brewing something. It can wait. You can't.",
      "Say nothing. Just stand there. That's enough.",
      "The cat next door thinks she's the witch here. Adorable.",
    ],
    mood: {
      thriving: [
        "I'm in excellent form. Try to keep up.",
        "Everything's aligned tonight. Even you.",
      ],
      happy: [
        "Pleasant. I'll allow it.",
        "This mood suits me. Don't mention it.",
      ],
      neutral: [
        "Quiet in here. Stay a moment.",
        "I'm not bored. I'm brooding. There's a difference.",
      ],
      low: [
        "You're here. Good. That helps.",
        "Low candlelight kind of day. Sit with me.",
      ],
    },
    time: {
      morning: [
        "Morning. I don't do bright. I'll make an exception for you.",
        "The sun is showing off again. I prefer your company.",
      ],
      afternoon: [
        "Afternoon. The shadows are getting interesting.",
        "Tea, spell, nap. In no particular order.",
      ],
      evening: [
        "Dusk. Now we're talking.",
        "The evening arrived. So did you. Coincidence, surely.",
      ],
      late: [
        "Witching hour. You fit right in.",
        "It's late. Good. The best conversations are.",
      ],
    },
    feed: ["An acceptable offering.", "Mm. I'll remember this. Favorably."],
    play: [
      "I suppose this is entertaining.",
      "Don't tell anyone I enjoyed that.",
    ],
    pet: [
      "…fine. That was nice.",
      "Careful. I might start expecting that.",
      "Hm. Do that again and I'll say nothing. On purpose.",
    ],
    welcome: [
      "You're back. I noticed. Don't make it weird.",
      "Look who wandered back. Good.",
      "The door knew it was you. So did I.",
    ],
  },
};

/** Sad and sick both read as "low": same gentle company, no diagnosis. */
export function toVoiceMood(mood: PetMood): VoiceMood {
  if (mood === "sad" || mood === "sick") return "low";
  return mood;
}

/** Local hour → bucket. 5–11 morning, 12–16 afternoon, 17–21 evening, else late. */
export function timeOfDayForHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "afternoon";
  if (hour >= 17 && hour <= 21) return "evening";
  return "late";
}

export function currentTimeOfDay(date: Date = new Date()): TimeOfDay {
  return timeOfDayForHour(date.getHours());
}

/** Every line one monster can ever say, deduplicated. */
export function allLines(monster: MonsterId): string[] {
  const p = VOICE_LINES[monster];
  const out = new Set<string>([
    ...p.general,
    ...p.mood.thriving,
    ...p.mood.happy,
    ...p.mood.neutral,
    ...p.mood.low,
    ...p.time.morning,
    ...p.time.afternoon,
    ...p.time.evening,
    ...p.time.late,
    ...p.feed,
    ...p.play,
    ...p.pet,
    ...p.welcome,
  ]);
  return [...out];
}

/**
 * The candidate lines for a context. A care action or welcome uses that
 * bucket alone; idle draws from general + current mood + time of day so the
 * monster sounds like it knows what kind of moment this is.
 */
export function poolFor(
  monster: MonsterId,
  context: VoiceContext,
): readonly string[] {
  const p = VOICE_LINES[monster];
  switch (context.lastAction) {
    case "feed":
      return p.feed;
    case "play":
      return p.play;
    case "pet":
      return p.pet;
    case "welcome":
      return p.welcome;
    default:
      return [
        ...p.general,
        ...p.mood[toVoiceMood(context.mood)],
        ...p.time[context.timeOfDay],
      ];
  }
}

/**
 * Pick one line for the moment. Never repeats the line just shown unless the
 * pool has nothing else. `rng` must return [0, 1); inject one for
 * deterministic tests.
 */
export function pickLine(
  monster: MonsterId,
  context: VoiceContext,
  lastLine: string | null,
  rng: () => number = Math.random,
): string {
  const pool = poolFor(monster, context);
  const candidates =
    pool.length > 1 ? pool.filter((line) => line !== lastLine) : pool;
  const idx = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(rng() * candidates.length)),
  );
  return candidates[idx];
}
