import {
  DEFAULT_MIN_TIME,
  FREE_ITEM_MAX_PRICE,
  REWARD_TABLE,
  TASK_MIN_TIMES,
  rollReward,
} from "@/constants/task-timers";

// ─── TASK_MIN_TIMES ───────────────────────────────────────────────────────────

describe("TASK_MIN_TIMES", () => {
  it("has an entry for every preset cleaning task", () => {
    const expectedTasks = [
      "wash-dishes",
      "wipe-counters",
      "clean-stovetop",
      "scrub-toilet",
      "wipe-sink",
      "make-bed",
      "tidy-floor",
      "vacuum",
      "dust-surfaces",
      "take-out-trash",
    ];
    for (const taskId of expectedTasks) {
      expect(TASK_MIN_TIMES).toHaveProperty(taskId);
    }
  });

  it("all values are positive integers (seconds)", () => {
    for (const [id, seconds] of Object.entries(TASK_MIN_TIMES)) {
      expect(seconds).toBeGreaterThan(0);
      expect(Number.isInteger(seconds)).toBe(true);
      expect(seconds).toBeGreaterThanOrEqual(60); // minimum 1 minute is reasonable
      // Sanity: no task should take longer than 30 minutes
      expect(seconds).toBeLessThanOrEqual(1800);
    }
  });

  it("quick tasks take 2 minutes", () => {
    expect(TASK_MIN_TIMES["make-bed"]).toBe(120);
    expect(TASK_MIN_TIMES["take-out-trash"]).toBe(120);
  });

  it("involved tasks take 5 minutes", () => {
    expect(TASK_MIN_TIMES["wash-dishes"]).toBe(300);
    expect(TASK_MIN_TIMES["vacuum"]).toBe(300);
  });
});

// ─── DEFAULT_MIN_TIME ─────────────────────────────────────────────────────────

describe("DEFAULT_MIN_TIME", () => {
  it("is 180 seconds (3 minutes)", () => {
    expect(DEFAULT_MIN_TIME).toBe(180);
  });
});

// ─── FREE_ITEM_MAX_PRICE ──────────────────────────────────────────────────────

describe("FREE_ITEM_MAX_PRICE", () => {
  it("is 50 points", () => {
    expect(FREE_ITEM_MAX_PRICE).toBe(50);
  });
});

// ─── REWARD_TABLE ─────────────────────────────────────────────────────────────

describe("REWARD_TABLE", () => {
  it("weights sum to exactly 100", () => {
    const total = REWARD_TABLE.reduce((sum, r) => sum + r.weight, 0);
    expect(total).toBe(100);
  });

  it("contains all four reward tiers", () => {
    const tiers = REWARD_TABLE.map((r) => r.outcome.tier);
    expect(tiers).toContain("base");
    expect(tiers).toContain("bonus_points");
    expect(tiers).toContain("free_item");
    expect(tiers).toContain("jackpot");
  });

  it("every outcome has a positive pointsMultiplier", () => {
    for (const { outcome } of REWARD_TABLE) {
      expect(outcome.pointsMultiplier).toBeGreaterThan(0);
    }
  });

  it("jackpot has the highest multiplier and includes a free item", () => {
    const jackpot = REWARD_TABLE.find((r) => r.outcome.tier === "jackpot")!;
    expect(jackpot.outcome.pointsMultiplier).toBe(2.0);
    expect(jackpot.outcome.includesFreeItem).toBe(true);
  });

  it("base tier does not include a free item", () => {
    const base = REWARD_TABLE.find((r) => r.outcome.tier === "base")!;
    expect(base.outcome.includesFreeItem).toBe(false);
    expect(base.outcome.pointsMultiplier).toBe(1.0);
  });

  it("jackpot is the rarest tier (lowest weight)", () => {
    const weights = REWARD_TABLE.map((r) => r.weight);
    const jackpotWeight = REWARD_TABLE.find(
      (r) => r.outcome.tier === "jackpot",
    )!.weight;
    expect(jackpotWeight).toBe(Math.min(...weights));
  });
});

// ─── rollReward ───────────────────────────────────────────────────────────────

describe("rollReward", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a valid RewardOutcome with all required fields", () => {
    const outcome = rollReward();
    expect(outcome).toHaveProperty("tier");
    expect(outcome).toHaveProperty("label");
    expect(outcome).toHaveProperty("emoji");
    expect(outcome).toHaveProperty("description");
    expect(outcome).toHaveProperty("pointsMultiplier");
    expect(outcome).toHaveProperty("includesFreeItem");
  });

  it("returns base tier when random is ~0 (first bucket)", () => {
    // weight=40 occupies 0–40; roll of 0 × 100 = 0 → first entry
    jest.spyOn(Math, "random").mockReturnValue(0);
    expect(rollReward().tier).toBe("base");
  });

  it("returns bonus_points tier for middle-range roll", () => {
    // base=40, bonus_points=35 → range 40–75; roll of 0.55 × 100 = 55
    jest.spyOn(Math, "random").mockReturnValue(0.55);
    expect(rollReward().tier).toBe("bonus_points");
  });

  it("returns free_item tier", () => {
    // base=40, bonus=35, free_item=20 → range 75–95; roll of 0.80 × 100 = 80
    jest.spyOn(Math, "random").mockReturnValue(0.8);
    expect(rollReward().tier).toBe("free_item");
  });

  it("returns jackpot tier for near-maximum roll", () => {
    // jackpot=5 → range 95–100; roll of 0.97 × 100 = 97
    jest.spyOn(Math, "random").mockReturnValue(0.97);
    expect(rollReward().tier).toBe("jackpot");
  });

  it("always returns one of the four valid tiers across many rolls", () => {
    const validTiers = new Set([
      "base",
      "bonus_points",
      "free_item",
      "jackpot",
    ]);
    for (let i = 0; i < 100; i++) {
      expect(validTiers.has(rollReward().tier)).toBe(true);
    }
  });
});
