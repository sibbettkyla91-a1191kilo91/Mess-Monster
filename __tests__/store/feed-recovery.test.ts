/**
 * Feed crash recovery. One successful Feed = one snack consumed + one +8/+8.
 * itemId lives on both store and pet receipts so a lost unsettled list still
 * consumes. If the item is unknown, stats must not apply a second time.
 */
import {
  executeFeed,
  recoverUnsettledFeeds,
} from "@/store/recover-unsettled-feeds";
import { STORE_ITEMS } from "@/store/store-items";
import {
  FEED_HAPPINESS_BOOST,
  FEED_HEALTH_BOOST,
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

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function snackQty(): number {
  return useStoreStore.getState().byMonster.nilly.owned[cookie.id]?.quantity ?? 0;
}

function nillyStats() {
  const slice = usePetStore.getState().byMonster.nilly;
  return { health: slice.health, happiness: slice.happiness };
}

beforeEach(async () => {
  usePlayerStore.setState({ selectedMonster: "nilly" });
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

describe("successful Feed receipts", () => {
  it("writes itemId and monsterId on both store and pet receipts", () => {
    useStoreStore.getState().buyItem(cookie);
    expect(executeFeed(cookie.id, "nilly")).toBe(true);

    const feedId = Object.keys(usePetStore.getState().appliedFeeds)[0];
    expect(feedId).toBeTruthy();
    expect(usePetStore.getState().appliedFeeds[feedId]).toEqual({
      fed: true,
      itemId: cookie.id,
      monsterId: "nilly",
    });
    expect(useStoreStore.getState().appliedFeeds[feedId]).toEqual({
      consumed: true,
      itemId: cookie.id,
      monsterId: "nilly",
    });
    expect(useStoreStore.getState().unsettledFeeds).toHaveLength(0);
  });
});

describe("crash after stats, before consume", () => {
  it("consumes the snack from the pet receipt when store never stored itemId", () => {
    useStoreStore.getState().buyItem(cookie);
    const feedId = "fed-store-never-stored-itemId";
    usePetStore.getState().applyFeed(feedId, "nilly", cookie.id);
    useStoreStore.setState({ unsettledFeeds: [], appliedFeeds: {} });

    expect(snackQty()).toBe(1);
    expect(nillyStats()).toEqual({
      health: 50 + FEED_HEALTH_BOOST,
      happiness: 50 + FEED_HAPPINESS_BOOST,
    });

    recoverUnsettledFeeds();
    recoverUnsettledFeeds();

    expect(snackQty()).toBe(0);
    expect(nillyStats()).toEqual({
      health: 50 + FEED_HEALTH_BOOST,
      happiness: 50 + FEED_HAPPINESS_BOOST,
    });
    expect(useStoreStore.getState().appliedFeeds[feedId]?.consumed).toBe(true);
  });

  it("consumes using the store receipt itemId when unsettled was lost", () => {
    useStoreStore.getState().buyItem(cookie);
    const feed = {
      id: "fed-unsettled-lost",
      itemId: cookie.id,
      monsterId: "nilly" as const,
    };
    useStoreStore.getState().beginFeed(feed);
    usePetStore.getState().applyFeed(feed.id, feed.monsterId, feed.itemId);
    useStoreStore.setState({
      unsettledFeeds: [],
      appliedFeeds: useStoreStore.getState().appliedFeeds,
    });

    expect(snackQty()).toBe(1);
    recoverUnsettledFeeds();
    recoverUnsettledFeeds();

    expect(snackQty()).toBe(0);
    expect(nillyStats()).toEqual({
      health: 50 + FEED_HEALTH_BOOST,
      happiness: 50 + FEED_HAPPINESS_BOOST,
    });
  });
});

describe("unknown item after a durable fed receipt", () => {
  it("does not grant a second +8/+8 and settles so the feed cannot replay", () => {
    useStoreStore.getState().buyItem(cookie);
    const feedId = "fed-unknown-item";
    usePetStore.setState({
      health: 50 + FEED_HEALTH_BOOST,
      happiness: 50 + FEED_HAPPINESS_BOOST,
      appliedFeeds: {
        [feedId]: { fed: true, monsterId: "nilly" },
      },
    });
    useStoreStore.setState({ unsettledFeeds: [], appliedFeeds: {} });

    recoverUnsettledFeeds();
    recoverUnsettledFeeds();

    expect(nillyStats()).toEqual({
      health: 50 + FEED_HEALTH_BOOST,
      happiness: 50 + FEED_HAPPINESS_BOOST,
    });
    expect(snackQty()).toBe(1);
    expect(useStoreStore.getState().appliedFeeds[feedId]?.consumed).toBe(true);
    expect(usePetStore.getState().appliedFeeds[feedId]?.fed).toBe(true);
  });
});

describe("crash after intent, before stats", () => {
  it("applies one +8/+8 and consumes exactly once", () => {
    useStoreStore.getState().buyItem(cookie);
    const feed = {
      id: "intent-only",
      itemId: cookie.id,
      monsterId: "nilly" as const,
    };
    useStoreStore.getState().beginFeed(feed);

    expect(snackQty()).toBe(1);
    expect(nillyStats()).toEqual({ health: 50, happiness: 50 });

    recoverUnsettledFeeds();
    recoverUnsettledFeeds();

    expect(snackQty()).toBe(0);
    expect(nillyStats()).toEqual({
      health: 50 + FEED_HEALTH_BOOST,
      happiness: 50 + FEED_HAPPINESS_BOOST,
    });
    expect(useStoreStore.getState().unsettledFeeds).toHaveLength(0);
  });
});
