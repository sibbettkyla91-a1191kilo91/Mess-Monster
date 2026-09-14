import { executeFeed, executePlay } from "@/store/recover-unsettled-feeds";
import { STORE_ITEMS } from "@/store/store-items";
import {
  FEED_HAPPINESS_BOOST,
  FEED_HEALTH_BOOST,
  PLAY_HAPPINESS_BOOST,
  PLAY_HEALTH_BOOST,
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

const cookie = STORE_ITEMS.find((i) => i.id === "food-cookie")!;
const boba = STORE_ITEMS.find((i) => i.id === "food-boba")!;
const yarn = STORE_ITEMS.find((i) => i.id === "toy-yarn")!;
const ball = STORE_ITEMS.find((i) => i.id === "toy-ball")!;

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(async () => {
  usePlayerStore.setState({
    selectedMonster: "nilly",
    lastTapReactionDate: "",
    tapReactionCount: 0,
    tapReactions: {
      nilly: { date: "", count: 0 },
      luna: { date: "", count: 0 },
    },
  });
  usePetStore.setState({
    health: 50,
    happiness: 50,
    lastCaredAt: Date.now(),
    lastSessionAt: Date.now(),
    appliedFeeds: {},
  });
  useStoreStore.setState({
    owned: {},
    placed: {},
    equipped: {},
    unsettledFeeds: [],
    appliedFeeds: {},
  });
  await flushHydration();
});

describe("Feed", () => {
  it("consumes one chosen snack and only bumps that monster", () => {
    useStoreStore.getState().buyItem(cookie);
    useStoreStore.getState().buyItem(boba);
    expect(executeFeed(boba.id, "nilly")).toBe(true);

    expect(useStoreStore.getState().byMonster.nilly.owned[boba.id].quantity).toBe(
      0,
    );
    expect(useStoreStore.getState().byMonster.nilly.owned[cookie.id].quantity).toBe(
      1,
    );
    expect(usePetStore.getState().byMonster.nilly.health).toBe(
      50 + FEED_HEALTH_BOOST,
    );
    expect(usePetStore.getState().byMonster.nilly.happiness).toBe(
      50 + FEED_HAPPINESS_BOOST,
    );
    expect(usePetStore.getState().byMonster.luna.health).toBe(100);
    expect(usePetStore.getState().byMonster.luna.happiness).toBe(100);
  });

  it("does nothing when that monster has no food", () => {
    expect(executeFeed(cookie.id, "nilly")).toBe(false);
    expect(usePetStore.getState().byMonster.nilly.health).toBe(50);
    expect(usePetStore.getState().byMonster.nilly.happiness).toBe(50);
  });
});

describe("Play", () => {
  it("does not consume the toy and only bumps that monster", () => {
    useStoreStore.getState().buyItem(yarn);
    useStoreStore.getState().buyItem(ball);
    expect(executePlay(yarn.id, "nilly")).toBe(true);

    expect(useStoreStore.getState().byMonster.nilly.owned[yarn.id].quantity).toBe(
      1,
    );
    expect(useStoreStore.getState().byMonster.nilly.owned[ball.id].quantity).toBe(
      1,
    );
    expect(usePetStore.getState().byMonster.nilly.happiness).toBe(
      50 + PLAY_HAPPINESS_BOOST,
    );
    expect(usePetStore.getState().byMonster.nilly.health).toBe(
      50 + PLAY_HEALTH_BOOST,
    );
    expect(usePetStore.getState().byMonster.luna.happiness).toBe(100);
  });

  it("does nothing when that monster has no toy", () => {
    expect(executePlay(yarn.id, "nilly")).toBe(false);
    expect(usePetStore.getState().byMonster.nilly.happiness).toBe(50);
  });
});

describe("Pet cap", () => {
  it("still grants +3 happiness five times a day per monster", () => {
    const today = "2026-09-14";
    usePlayerStore.setState({
      lastTapReactionDate: today,
      tapReactionCount: 0,
      tapReactions: {
        nilly: { date: today, count: 0 },
        luna: { date: "", count: 0 },
      },
    });

    for (let i = 0; i < 5; i++) {
      expect(usePlayerStore.getState().recordTapReaction()).toBe(true);
      usePetStore.getState().addHappiness(3);
    }
    expect(usePlayerStore.getState().tapReactions.nilly.count).toBe(5);
    expect(usePetStore.getState().byMonster.nilly.happiness).toBe(65);
    expect(usePlayerStore.getState().recordTapReaction()).toBe(false);
    expect(usePetStore.getState().byMonster.nilly.happiness).toBe(65);

    usePlayerStore.getState().selectMonster("luna");
    usePetStore.setState({ happiness: 50 });
    expect(usePlayerStore.getState().recordTapReaction()).toBe(true);
    usePetStore.getState().addHappiness(3);
    expect(usePetStore.getState().byMonster.luna.happiness).toBe(53);
    expect(usePetStore.getState().byMonster.nilly.happiness).toBe(65);
  });
});
