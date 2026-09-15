/**
 * Progression is pure math over a monster's lifetime points. These tests pin
 * the ladder, the derived progress numbers, and the milestone table's
 * agreement with the catalog's unlock tiers.
 */
import { MONSTER_IDS } from "@/store/monster-id";
import {
  LEVEL_THRESHOLDS,
  levelForXp,
  MAX_LEVEL,
  MILESTONES,
  milestoneForLevel,
  milestoneGrantId,
  unclaimedMilestones,
  xpForLevel,
  xpToNextLevel,
} from "@/store/progression";
import { getStoreItem, STORE_ITEMS } from "@/store/store-items";

describe("level ladder", () => {
  it("starts at 0 and strictly increases", () => {
    expect(LEVEL_THRESHOLDS[0]).toBe(0);
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      expect(LEVEL_THRESHOLDS[i]).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]);
    }
    expect(MAX_LEVEL).toBe(LEVEL_THRESHOLDS.length);
  });

  it("advances exactly at each threshold", () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const floor = xpForLevel(level);
      expect(levelForXp(floor)).toBe(level);
      if (level > 1) expect(levelForXp(floor - 1)).toBe(level - 1);
    }
  });

  it("is 1 for zero, negative, NaN or missing points and caps at MAX_LEVEL", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(-50)).toBe(1);
    expect(levelForXp(Number.NaN)).toBe(1);
    expect(levelForXp(Number.POSITIVE_INFINITY)).toBe(1);
    expect(levelForXp(10_000_000)).toBe(MAX_LEVEL);
  });

  it("level 2 is reachable in a few ordinary chores", () => {
    // 10–40 pts per task: a couple of days, not a month.
    expect(xpForLevel(2)).toBeLessThanOrEqual(100);
  });
});

describe("xpToNextLevel", () => {
  it("describes progress inside a level", () => {
    const p = xpToNextLevel(xpForLevel(2) + 30);
    expect(p.level).toBe(2);
    expect(p.intoLevel).toBe(30);
    expect(p.span).toBe(xpForLevel(3) - xpForLevel(2));
    expect(p.remaining).toBe(p.span - 30);
    expect(p.fraction).toBeCloseTo(30 / p.span);
    expect(p.atMax).toBe(false);
  });

  it("is empty at a fresh level and full at the top", () => {
    expect(xpToNextLevel(0)).toMatchObject({
      level: 1,
      intoLevel: 0,
      fraction: 0,
      atMax: false,
    });
    const top = xpToNextLevel(xpForLevel(MAX_LEVEL) + 999);
    expect(top).toMatchObject({
      level: MAX_LEVEL,
      span: 0,
      remaining: 0,
      fraction: 1,
      atMax: true,
    });
  });
});

describe("milestones", () => {
  it("levels are unique, ascending and within the ladder", () => {
    const levels = MILESTONES.map((m) => m.level);
    expect(new Set(levels).size).toBe(levels.length);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    for (const level of levels) {
      expect(level).toBeGreaterThanOrEqual(2);
      expect(level).toBeLessThanOrEqual(MAX_LEVEL);
    }
  });

  it("every milestone does something and speaks for both monsters", () => {
    for (const m of MILESTONES) {
      expect(!!m.points || !!m.itemId || !!m.unlocksShopTier).toBe(true);
      expect(m.title.trim().length).toBeGreaterThan(0);
      for (const monster of MONSTER_IDS) {
        expect(m.note[monster].trim().length).toBeGreaterThan(0);
      }
      if (m.points) expect(m.points).toBeGreaterThan(0);
    }
  });

  it("item rewards are real catalog items belonging to the right monster", () => {
    for (const m of MILESTONES) {
      if (!m.itemId) continue;
      for (const monster of MONSTER_IDS) {
        const item = getStoreItem(m.itemId[monster]);
        expect(item).toBeDefined();
        expect(item!.monster).toBe(monster);
      }
    }
  });

  it("shop-tier milestones point at levels where the catalog actually opens items", () => {
    const unlockLevels = new Set(
      STORE_ITEMS.filter((i) => i.unlock).map((i) => i.unlock!.level),
    );
    expect([...unlockLevels].sort((a, b) => a - b)).toEqual([2, 4, 6, 8]);
    const tierLevels = MILESTONES.filter((m) => m.unlocksShopTier).map(
      (m) => m.level,
    );
    expect(tierLevels.length).toBeGreaterThan(0);
    for (const level of tierLevels) expect(unlockLevels.has(level)).toBe(true);
    // Every shelf the catalog opens is announced, and nothing else is.
    expect(tierLevels).toEqual([2, 4, 6, 8]);
    expect(tierLevels).toEqual([...unlockLevels].sort((a, b) => a - b));
  });

  it("shelf-opening milestones carry no payout; only the last one says so", () => {
    const lastUnlockLevel = Math.max(
      ...STORE_ITEMS.filter((i) => i.unlock).map((i) => i.unlock!.level),
    );
    expect(lastUnlockLevel).toBe(8);
    for (const m of MILESTONES) {
      if (m.unlocksShopTier) {
        expect(m.points).toBeUndefined();
        expect(m.itemId).toBeUndefined();
      }
      const copy = [m.title, ...MONSTER_IDS.map((id) => m.note[id])]
        .join(" ")
        .toLowerCase();
      const claimsLast =
        copy.includes("last shelf") ||
        copy.includes("every shelf") ||
        copy.includes("whole shop") ||
        copy.includes("everything in the shop");
      expect(claimsLast).toBe(m.level === lastUnlockLevel);
    }
  });

  it("looks up by level and builds stable grant ids", () => {
    const first = MILESTONES[0];
    expect(milestoneForLevel(first.level)).toBe(first);
    expect(milestoneForLevel(1)).toBeUndefined();
    expect(milestoneGrantId("luna", 4)).toBe("luna:milestone:4");
  });

  it("unclaimedMilestones returns reached levels not yet claimed", () => {
    const xpAtLevel4 = xpForLevel(4);
    const due = unclaimedMilestones(xpAtLevel4, []).map((m) => m.level);
    expect(due).toEqual(
      MILESTONES.filter((m) => m.level <= 4).map((m) => m.level),
    );
    expect(unclaimedMilestones(xpAtLevel4, due).length).toBe(0);
    expect(unclaimedMilestones(0, []).length).toBe(0);
  });
});
