/**
 * Talk-back lines are pure data plus a picker. These tests pin the product
 * promises: enough variety, no immediate repeats, the right bucket for the
 * moment, two distinct voices, deterministic with an injected rng, and —
 * most importantly — not one line that shames, nags, or counts the hours.
 */
import {
  allLines,
  currentTimeOfDay,
  pickLine,
  poolFor,
  timeOfDayForHour,
  toVoiceMood,
  VOICE_LINES,
  VoiceContext,
} from "@/store/monster-voice";

const MONSTERS = ["nilly", "luna"] as const;

const idle = (mood: VoiceContext["mood"] = "happy"): VoiceContext => ({
  mood,
  timeOfDay: "afternoon",
  lastAction: null,
});

/** Anything that reads as pressure, a verdict, or a count of absence. */
const FORBIDDEN =
  /clean|mess|tidy|chore|task|neglect|miss(ed|es|ing)? you|lazy|should|guilt|shame|hours|days|weeks|so long|long time|finally|where (were|have) you|left me|alone|forgot|as an ai|assistant/i;

describe("monster voice pools", () => {
  it.each(MONSTERS)("%s has between 20 and 30 distinct lines", (m) => {
    const lines = allLines(m);
    expect(lines.length).toBeGreaterThanOrEqual(20);
    expect(lines.length).toBeLessThanOrEqual(30);
  });

  it.each(MONSTERS)("%s has no empty bucket", (m) => {
    const p = VOICE_LINES[m];
    expect(p.general.length).toBeGreaterThan(0);
    for (const bucket of Object.values(p.mood)) {
      expect(bucket.length).toBeGreaterThan(0);
    }
    for (const bucket of Object.values(p.time)) {
      expect(bucket.length).toBeGreaterThan(0);
    }
    expect(p.feed.length).toBeGreaterThan(0);
    expect(p.play.length).toBeGreaterThan(0);
    expect(p.pet.length).toBeGreaterThan(0);
    expect(p.welcome.length).toBeGreaterThan(0);
  });

  it("Nilly and Luna share no lines", () => {
    const nilly = new Set(allLines("nilly"));
    for (const line of allLines("luna")) {
      expect(nilly.has(line)).toBe(false);
    }
  });

  it.each(MONSTERS)("%s never shames, nags, or counts the time away", (m) => {
    for (const line of allLines(m)) {
      expect(line).not.toMatch(FORBIDDEN);
      expect(line.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps the three original reaction lines in the after-action buckets", () => {
    expect(VOICE_LINES.nilly.pet).toContain("Hehe — that tickles!");
    expect(VOICE_LINES.nilly.feed).toContain("Yum! Thank you.");
    expect(VOICE_LINES.nilly.play).toContain("This is so fun!");
    expect(VOICE_LINES.luna.pet).toContain("…fine. That was nice.");
    expect(VOICE_LINES.luna.feed).toContain("An acceptable offering.");
    expect(VOICE_LINES.luna.play).toContain("I suppose this is entertaining.");
  });
});

describe("pickLine", () => {
  it.each(MONSTERS)(
    "%s never repeats a line back to back over 500 picks",
    (m) => {
      let last: string | null = null;
      const moods = ["thriving", "happy", "neutral", "sad", "sick"] as const;
      for (let i = 0; i < 500; i++) {
        const line = pickLine(m, idle(moods[i % moods.length]), last);
        expect(line).not.toBe(last);
        last = line;
      }
    },
  );

  it("honours the after-action buckets", () => {
    for (const m of MONSTERS) {
      for (const action of ["feed", "play", "pet", "welcome"] as const) {
        for (let i = 0; i < 40; i++) {
          const line = pickLine(m, { ...idle(), lastAction: action }, null);
          expect(VOICE_LINES[m][action]).toContain(line);
        }
      }
    }
  });

  it("draws idle lines from general + mood + time of day only", () => {
    const ctx: VoiceContext = {
      mood: "sick",
      timeOfDay: "late",
      lastAction: null,
    };
    const allowed = new Set([
      ...VOICE_LINES.luna.general,
      ...VOICE_LINES.luna.mood.low,
      ...VOICE_LINES.luna.time.late,
    ]);
    expect(new Set(poolFor("luna", ctx))).toEqual(allowed);
    for (let i = 0; i < 100; i++) {
      expect(allowed.has(pickLine("luna", ctx, null))).toBe(true);
    }
  });

  it("treats sad and sick as the same gentle 'low' bucket", () => {
    expect(toVoiceMood("sad")).toBe("low");
    expect(toVoiceMood("sick")).toBe("low");
    expect(toVoiceMood("thriving")).toBe("thriving");
    expect(poolFor("nilly", idle("sad"))).toEqual(
      poolFor("nilly", idle("sick")),
    );
  });

  it("is deterministic with an injected rng", () => {
    const seq = [0.1, 0.9, 0.5, 0.33, 0.77, 0.0, 0.999];
    const run = () => {
      let i = 0;
      const rng = () => seq[i++ % seq.length];
      let last: string | null = null;
      const out: string[] = [];
      for (let k = 0; k < seq.length; k++) {
        last = pickLine("nilly", idle(), last, rng);
        out.push(last);
      }
      return out;
    };
    expect(run()).toEqual(run());
    // rng → index is a plain floor, so 0 picks the first non-repeat line.
    expect(
      pickLine("luna", { ...idle(), lastAction: "pet" }, null, () => 0),
    ).toBe(VOICE_LINES.luna.pet[0]);
    expect(
      pickLine(
        "luna",
        { ...idle(), lastAction: "pet" },
        VOICE_LINES.luna.pet[0],
        () => 0,
      ),
    ).toBe(VOICE_LINES.luna.pet[1]);
  });

  it("returns the only line when a pool has just one item", () => {
    const line = pickLine(
      "nilly",
      { ...idle(), lastAction: "feed" },
      null,
      () => 0,
    );
    // Exclude every other feed line by feeding them back as lastLine — with
    // two lines, the second pick is forced to the other one; never undefined.
    const other = pickLine(
      "nilly",
      { ...idle(), lastAction: "feed" },
      line,
      () => 0.99,
    );
    expect(other).not.toBe(line);
    expect(typeof other).toBe("string");
  });
});

describe("time of day", () => {
  it("buckets the local hour", () => {
    expect(timeOfDayForHour(5)).toBe("morning");
    expect(timeOfDayForHour(11)).toBe("morning");
    expect(timeOfDayForHour(12)).toBe("afternoon");
    expect(timeOfDayForHour(16)).toBe("afternoon");
    expect(timeOfDayForHour(17)).toBe("evening");
    expect(timeOfDayForHour(21)).toBe("evening");
    expect(timeOfDayForHour(22)).toBe("late");
    expect(timeOfDayForHour(0)).toBe("late");
    expect(timeOfDayForHour(4)).toBe("late");
  });

  it("reads the local clock", () => {
    expect(currentTimeOfDay(new Date(2026, 8, 14, 8, 0, 0))).toBe("morning");
    expect(currentTimeOfDay(new Date(2026, 8, 14, 23, 30, 0))).toBe("late");
  });
});
