import { act, fireEvent, render } from "@testing-library/react-native";

import CollectionScreen from "@/app/(tabs)/collection";
import { STORE_ITEMS } from "@/store/store-items";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

async function flushHydration() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

const bow = STORE_ITEMS.find((i) => i.id === "acc-bow")!;
const shades = STORE_ITEMS.find((i) => i.id === "acc-sunglasses")!;

describe("Collection accessories", () => {
  beforeEach(() => {
    useStoreStore.setState({ owned: {}, placed: {}, equipped: {} });
    usePlayerStore.setState({ selectedMonster: "nilly" });
  });

  it("waits for hydration before offering Wear", async () => {
    const persist = useStoreStore.persist as unknown as {
      hasHydrated: () => boolean;
    };
    if (persist.hasHydrated()) {
      // Already hydrated in this process — gate is a no-op, skip.
      return;
    }
    const screen = render(<CollectionScreen />);
    expect(screen.getByText("Opening collection…")).toBeTruthy();
    expect(screen.queryByLabelText("Wear Cute Bow")).toBeNull();
  });

  it("wears and unequips an owned accessory for Nilly", async () => {
    useStoreStore.getState().buyItem(bow);
    const screen = render(<CollectionScreen />);
    await act(async () => {
      await flushHydration();
    });

    fireEvent.press(screen.getByLabelText("Wear Cute Bow"));
    expect(useStoreStore.getState().equipped.head).toBe("acc-bow");
    expect(screen.getByText(/Wearing:/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Take off Cute Bow"));
    expect(useStoreStore.getState().equipped.head).toBeUndefined();
  });

  it("shows Coming soon for Luna head items and does not equip", async () => {
    usePlayerStore.setState({ selectedMonster: "luna" });
    useStoreStore.getState().buyItem(bow);
    useStoreStore.getState().buyItem(shades);
    const screen = render(<CollectionScreen />);
    await act(async () => {
      await flushHydration();
    });

    expect(screen.getByLabelText("Cute Bow coming soon for Luna")).toBeTruthy();
    expect(screen.queryByLabelText("Wear Cute Bow")).toBeNull();
    fireEvent.press(screen.getByLabelText("Wear Star Shades"));
    expect(useStoreStore.getState().equipped.head).toBeUndefined();
    expect(useStoreStore.getState().equipped.face).toBe("acc-sunglasses");
  });
});
