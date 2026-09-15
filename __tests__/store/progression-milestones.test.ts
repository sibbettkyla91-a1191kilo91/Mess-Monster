/**
 * Milestone payouts cross stores (pet claimed-mark, player points, store
 * item) and must land exactly once — on a clean settle, on a replay, and
 * after a crash between the claimed-mark and the payout.
 */
import {
  recoverUnsettledMilestones,
  settleMilestonesFor,
  settleMilestonesForSelected,
} from "@/store/progression-milestones";
import {
  MILESTONES,
  milestoneGrantId,
  xpForLevel,
} from "@/store/progression";
import { isItemUnlockedFor } from "@/store/recover-unsettled-purchases";
import { getStoreItem } from "@/store/store-items";
import {
  createDefaultPetSlice,
  sanitizePetPersisted,
  usePetStore,
} from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/daily-nudge", () => ({
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

const POINTS_MILESTONE = MILESTONES.find((m) => m.points)!;
const ITEM_MILESTONE = MILESTONES.find((m) => m.itemId)!;
const TIER_MILESTONE = MILESTONES.find((m) => m.unlocksShopTier)!;

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function seedPet(nillyXp: number, lunaXp = 0) {
  usePetStore.setState({
    byMonster: {
      nilly: { ...createDefaultPetSlice(), totalPointsEarned: nillyXp },
      luna: { ...createDefaultPetSlice(), totalPointsEarned: lunaXp },
    },
    unsettledMilestones: [],
    appliedRewardGrants: {},
  });
}

beforeEach(async () => {
  usePlayerStore.setState({
    selectedMonster: "nilly",
    totalPoints: 100,
    spentPoints: 0,
    appliedRewardGrants: {},
  });
  seedPet(0);
  useStoreStore.setState({
    byMonster: {
      nilly: { owned: {}, placed: {}, equipped: {} },
      luna: { owned: {}, placed: {}, equipped: {} },
    },
    appliedRewardGrants: {},
  });
  await flushHydration();
});

describe("settleMilestonesFor", () => {
  it("does nothing below the first milestone", () => {
    seedPet(xpForLevel(MILESTONES[0].level) - 1);
    expect(settleMilestonesFor("nilly")).toEqual([]);
    expect(usePetStore.getState().byMonster.nilly.claimedMilestones).toEqual(
      [],
    );
    expect(usePlayerStore.getState().totalPoints).toBe(100);
  });

  it("pays a points milestone once and marks it claimed on that monster", () => {
    seedPet(xpForLevel(POINTS_MILESTONE.level));
    const newly = settleMilestonesFor("nilly");
    expect(newly).toContain(POINTS_MILESTONE.level);

    const pet = usePetStore.getState();
    expect(pet.byMonster.nilly.claimedMilestones).toEqual(
      MILESTONES.filter((m) => m.level <= POINTS_MILESTONE.level).map(
        (m) => m.level,
      ),
    );
    expect(pet.byMonster.luna.claimedMilestones).toEqual([]);
    expect(pet.unsettledMilestones).toEqual([]);
    const paid = MILESTONES.filter(
      (m) => m.level <= POINTS_MILESTONE.level && m.points,
    ).reduce((sum, m) => sum + (m.points ?? 0), 0);
    expect(usePlayerStore.getState().totalPoints).toBe(100 + paid);
    expect(
      usePlayerStore.getState().appliedRewardGrants[
        milestoneGrantId("nilly", POINTS_MILESTONE.level)
      ],
    ).toEqual({ points: true });

    // Second settle: nothing new, nothing paid twice.
    expect(settleMilestonesFor("nilly")).toEqual([]);
    expect(usePlayerStore.getState().totalPoints).toBe(100 + paid);
  });

  it("puts an item milestone's gift into that monster's bag, once", () => {
    seedPet(xpForLevel(ITEM_MILESTONE.level));
    settleMilestonesFor("nilly");
    const giftId = ITEM_MILESTONE.itemId!.nilly;
    const bag = useStoreStore.getState().byMonster.nilly.owned;
    expect(bag[giftId].quantity).toBe(1);
    expect(bag[giftId].item).toEqual(getStoreItem(giftId));
    expect(useStoreStore.getState().byMonster.luna.owned).toEqual({});

    settleMilestonesFor("nilly");
    recoverUnsettledMilestones();
    expect(useStoreStore.getState().byMonster.nilly.owned[giftId].quantity).toBe(
      1,
    );
  });

  it("a tier milestone unlocks the shop items gated on that level", () => {
    const locked = getStoreItem("nilly-food-mushroom-chips")!;
    expect(locked.unlock?.level).toBe(TIER_MILESTONE.level);
    expect(isItemUnlockedFor(locked, "nilly")).toBe(false);

    seedPet(xpForLevel(TIER_MILESTONE.level));
    expect(settleMilestonesFor("nilly")).toContain(TIER_MILESTONE.level);
    expect(isItemUnlockedFor(locked, "nilly")).toBe(true);
    // Unlocks are read from level, so Luna at level 1 still sees it locked
    // — and it is not her item anyway.
    expect(isItemUnlockedFor(locked, "luna")).toBe(false);
    // Nothing paid for an unlock-only milestone.
    const unlockOnly = MILESTONES.filter(
      (m) => m.level <= TIER_MILESTONE.level && !m.unlocksShopTier,
    );
    if (unlockOnly.length === 0) {
      expect(usePlayerStore.getState().totalPoints).toBe(100);
    }
  });

  it("settles the selected monster only", () => {
    usePlayerStore.setState({ selectedMonster: "luna" });
    seedPet(xpForLevel(POINTS_MILESTONE.level), xpForLevel(POINTS_MILESTONE.level));
    settleMilestonesForSelected();
    const pet = usePetStore.getState();
    expect(pet.byMonster.luna.claimedMilestones).toContain(
      POINTS_MILESTONE.level,
    );
    expect(pet.byMonster.nilly.claimedMilestones).toEqual([]);
  });
});

describe("crash recovery", () => {
  it("finishes a payout whose intent survived but whose receipts did not", () => {
    seedPet(xpForLevel(POINTS_MILESTONE.level));
    // Simulate: claimed-mark + intent written, app died before the payout.
    const id = milestoneGrantId("nilly", POINTS_MILESTONE.level);
    usePetStore.setState({
      byMonster: {
        ...usePetStore.getState().byMonster,
        nilly: {
          ...usePetStore.getState().byMonster.nilly,
          claimedMilestones: MILESTONES.filter(
            (m) => m.level <= POINTS_MILESTONE.level,
          ).map((m) => m.level),
        },
      },
      unsettledMilestones: [
        { id, monster: "nilly", level: POINTS_MILESTONE.level },
      ],
    });

    recoverUnsettledMilestones();
    expect(usePlayerStore.getState().totalPoints).toBe(
      100 + POINTS_MILESTONE.points!,
    );
    expect(usePetStore.getState().unsettledMilestones).toEqual([]);

    // Foreground replay / second cold start: no double pay.
    recoverUnsettledMilestones();
    settleMilestonesFor("nilly");
    expect(usePlayerStore.getState().totalPoints).toBe(
      100 + POINTS_MILESTONE.points!,
    );
  });

  it("a payout whose receipt landed but whose intent did not clear is a no-op", () => {
    const id = milestoneGrantId("nilly", POINTS_MILESTONE.level);
    seedPet(xpForLevel(POINTS_MILESTONE.level));
    usePlayerStore.setState({
      totalPoints: 100 + POINTS_MILESTONE.points!,
      appliedRewardGrants: { [id]: { points: true } },
    });
    usePetStore.setState({
      byMonster: {
        ...usePetStore.getState().byMonster,
        nilly: {
          ...usePetStore.getState().byMonster.nilly,
          claimedMilestones: MILESTONES.filter(
            (m) => m.level <= POINTS_MILESTONE.level,
          ).map((m) => m.level),
        },
      },
      unsettledMilestones: [
        { id, monster: "nilly", level: POINTS_MILESTONE.level },
      ],
    });
    recoverUnsettledMilestones();
    expect(usePlayerStore.getState().totalPoints).toBe(
      100 + POINTS_MILESTONE.points!,
    );
    expect(usePetStore.getState().unsettledMilestones).toEqual([]);
  });

  it("drops an intent for a level that has no milestone", () => {
    usePetStore.setState({
      unsettledMilestones: [
        { id: "nilly:milestone:1", monster: "nilly", level: 1 },
      ],
    });
    recoverUnsettledMilestones();
    expect(usePetStore.getState().unsettledMilestones).toEqual([]);
    expect(usePlayerStore.getState().totalPoints).toBe(100);
  });
});

describe("coexistence with the evolution system", () => {
  it("leaves a non-default evolutionStage alone and still levels/pays", () => {
    usePetStore.setState({
      byMonster: {
        nilly: {
          ...createDefaultPetSlice(),
          evolutionStage: "adult",
          adultVariant: "kitchen",
          totalPointsEarned: xpForLevel(POINTS_MILESTONE.level),
        },
        luna: { ...createDefaultPetSlice(), evolutionStage: "teen" },
      },
      unsettledMilestones: [],
    });
    settleMilestonesFor("nilly");
    const nilly = usePetStore.getState().byMonster.nilly;
    expect(nilly.evolutionStage).toBe("adult");
    expect(nilly.adultVariant).toBe("kitchen");
    expect(nilly.pendingEvolution).toBeNull();
    expect(nilly.claimedMilestones).toContain(POINTS_MILESTONE.level);
    expect(usePetStore.getState().byMonster.luna.evolutionStage).toBe("teen");
    expect(usePetStore.getState().byMonster.luna.claimedMilestones).toEqual([]);
  });
});

describe("persistence shape", () => {
  it("claimedMilestones and unsettledMilestones survive a sanitize round-trip", () => {
    const clean = sanitizePetPersisted({
      byMonster: {
        nilly: { ...createDefaultPetSlice(), claimedMilestones: [2, 3, 3, "x", -1, 2.5] },
        luna: createDefaultPetSlice(),
      },
      unsettledMilestones: [
        { id: "nilly:milestone:3", monster: "nilly", level: 3 },
        { id: "bad", monster: "dracula", level: 3 },
        { monster: "luna", level: 2 },
        "junk",
      ],
    });
    expect(clean.byMonster.nilly.claimedMilestones).toEqual([2, 3]);
    expect(clean.byMonster.luna.claimedMilestones).toEqual([]);
    expect(clean.unsettledMilestones).toEqual([
      { id: "nilly:milestone:3", monster: "nilly", level: 3 },
    ]);
  });

  it("a save without the new fields hydrates to empty lists", () => {
    const clean = sanitizePetPersisted({
      byMonster: { nilly: { health: 70 }, luna: {} },
    });
    expect(clean.byMonster.nilly.claimedMilestones).toEqual([]);
    expect(clean.unsettledMilestones).toEqual([]);
  });
});
