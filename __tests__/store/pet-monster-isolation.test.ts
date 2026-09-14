/**
 * Nilly and Luna each keep their own health, happiness, evolution, and bag.
 * An older shared save lands on whoever was selected (or Nilly if none).
 */
import { migratePetState, usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { STORE_ITEMS } from "@/store/store-items";
import { migrateStoreState, useStoreStore } from "@/store/use-store-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/daily-nudge", () => ({
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

const cookie = STORE_ITEMS.find((i) => i.id === "nilly-food-granola-honey-bar")!;
const yarn = STORE_ITEMS.find((i) => i.id === "nilly-toy-tie-dye-yarn-ball")!;

beforeEach(() => {
  usePlayerStore.setState({ selectedMonster: "nilly" });
  usePetStore.setState({
    byMonster: {
      nilly: {
        health: 100,
        happiness: 100,
        lastCaredAt: Date.now(),
        lastSessionAt: Date.now(),
        evolutionStage: "egg",
        totalPointsEarned: 0,
        adultVariant: "base",
        categoryCompletions: {},
        pendingEvolution: null,
        pendingPremiumGate: null,
        premiumGateShownFor: null,
        claimedMilestones: [],
      },
      luna: {
        health: 100,
        happiness: 100,
        lastCaredAt: Date.now(),
        lastSessionAt: Date.now(),
        evolutionStage: "egg",
        totalPointsEarned: 0,
        adultVariant: "base",
        categoryCompletions: {},
        pendingEvolution: null,
        pendingPremiumGate: null,
        premiumGateShownFor: null,
        claimedMilestones: [],
      },
    },
    health: 100,
    happiness: 100,
    evolutionStage: "egg",
    totalPointsEarned: 0,
    lastCaredAt: Date.now(),
    lastSessionAt: Date.now(),
    appliedFeeds: {},
  });
  useStoreStore.setState({
    byMonster: {
      nilly: { owned: {}, placed: {}, equipped: {} },
      luna: { owned: {}, placed: {}, equipped: {} },
    },
    owned: {},
    placed: {},
    equipped: {},
  });
});

describe("migrate shared pet save", () => {
  it("puts the old blob on Nilly when no monster was selected, and Luna starts as a fresh egg", () => {
    const out = migratePetState(
      {
        health: 40,
        happiness: 30,
        lastCaredAt: 1_700_000_000_000,
        lastSessionAt: 1_700_000_000_000,
        evolutionStage: "teen",
        totalPointsEarned: 220,
        adultVariant: "base",
        categoryCompletions: { kitchen: 4 },
      },
      3,
    );

    expect(out.byMonster.nilly.evolutionStage).toBe("teen");
    expect(out.byMonster.nilly.health).toBe(40);
    expect(out.byMonster.nilly.totalPointsEarned).toBe(220);
    expect(out.byMonster.luna.evolutionStage).toBe("egg");
    expect(out.byMonster.luna.health).toBe(100);
    expect(out.byMonster.luna.happiness).toBe(100);
    expect(out.legacySharedPet.evolutionStage).toBe("teen");
  });

  it("puts the old shop bag on Nilly and leaves Luna empty", () => {
    const out = migrateStoreState(
      {
        owned: {
          "nilly-food-granola-honey-bar": {
            item: cookie,
            quantity: 2,
            purchasedAt: 1_700_000_000_000,
          },
        },
        placed: { "nilly-toy-tie-dye-yarn-ball": true },
        equipped: { head: "nilly-accessory-friendship-bracelet" },
      },
      3,
    );

    expect(out.byMonster.nilly.owned["nilly-food-granola-honey-bar"].quantity).toBe(2);
    expect(out.byMonster.nilly.placed["nilly-toy-tie-dye-yarn-ball"]).toBe(true);
    expect(out.byMonster.nilly.equipped.head).toBe("nilly-accessory-friendship-bracelet");
    expect(out.byMonster.luna.owned).toEqual({});
    expect(out.byMonster.luna.placed).toEqual({});
    expect(out.byMonster.luna.equipped).toEqual({});
  });
});

describe("two monsters stay isolated", () => {
  it("caring for Nilly does not change Luna", () => {
    usePetStore.setState({ health: 50, happiness: 40 });
    usePetStore.getState().care();

    expect(usePetStore.getState().byMonster.nilly.health).toBe(65);
    expect(usePetStore.getState().byMonster.nilly.happiness).toBe(60);
    expect(usePetStore.getState().byMonster.luna.health).toBe(100);
    expect(usePetStore.getState().byMonster.luna.happiness).toBe(100);
  });

  it("food bought while Nilly is selected stays out of Luna's bag", () => {
    useStoreStore.getState().buyItem(cookie);
    useStoreStore.getState().buyItem(yarn);

    expect(useStoreStore.getState().byMonster.nilly.owned[cookie.id].quantity).toBe(
      1,
    );
    expect(useStoreStore.getState().byMonster.nilly.owned[yarn.id].quantity).toBe(
      1,
    );
    expect(useStoreStore.getState().byMonster.luna.owned[cookie.id]).toBeUndefined();
    expect(useStoreStore.getState().byMonster.luna.owned[yarn.id]).toBeUndefined();
  });

  it("switching to Luna reads Luna's empty bag and stats", () => {
    useStoreStore.getState().buyItem(cookie);
    usePetStore.setState({ health: 50, happiness: 40 });

    usePlayerStore.getState().selectMonster("luna");

    expect(useStoreStore.getState().owned[cookie.id]).toBeUndefined();
    expect(usePetStore.getState().health).toBe(100);
    expect(usePetStore.getState().happiness).toBe(100);
  });
});
