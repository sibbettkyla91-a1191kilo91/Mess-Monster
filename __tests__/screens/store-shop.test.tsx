/**
 * The Shop screen shows the selected monster's shelf, states locks plainly,
 * and buys through executePaidShopPurchase: food into the bag (not eaten),
 * collectibles once, locked items refused.
 */
import { act, fireEvent, render } from "@testing-library/react-native";

import StoreScreen from "@/app/(tabs)/store";
import { xpForLevel } from "@/store/progression";
import { getStoreItem } from "@/store/store-items";
import { createDefaultPetSlice, usePetStore } from "@/store/use-pet-store";
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

jest.mock("@/utils/daily-nudge", () => ({
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

async function flushHydration() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

const granola = getStoreItem("nilly-food-granola-honey-bar")!;
const sunflower = getStoreItem("nilly-plant-sunflower")!;
const crown = getStoreItem("nilly-accessory-daisy-chain-crown")!;

async function mountShop(monster: "nilly" | "luna" = "nilly", xp = 0) {
  usePlayerStore.setState({
    selectedMonster: monster,
    monsterName: "",
    totalPoints: 500,
    spentPoints: 0,
    appliedPurchases: {},
  });
  usePetStore.setState({
    byMonster: {
      nilly: {
        ...createDefaultPetSlice(),
        health: 50,
        happiness: 50,
        totalPointsEarned: monster === "nilly" ? xp : 0,
      },
      luna: {
        ...createDefaultPetSlice(),
        health: 50,
        happiness: 50,
        totalPointsEarned: monster === "luna" ? xp : 0,
      },
    },
    appliedPurchases: {},
  });
  useStoreStore.setState({
    byMonster: {
      nilly: { owned: {}, placed: {}, equipped: {} },
      luna: { owned: {}, placed: {}, equipped: {} },
    },
    unsettledPurchases: [],
    appliedPurchases: {},
  });
  const screen = render(<StoreScreen />);
  await act(async () => {
    await flushHydration();
  });
  return screen;
}

describe("Shop screen", () => {
  it("shows the selected monster's shelf and a level header", async () => {
    const screen = await mountShop("luna");
    fireEvent.press(screen.getByLabelText("Food"));
    expect(screen.getByText("Dark Chocolate Truffle")).toBeTruthy();
    expect(screen.queryByText("Granola & Honey Bar")).toBeNull();
    expect(screen.getByText("Luna · Level 1")).toBeTruthy();
    expect(screen.getByText(`${xpForLevel(2)} pts to level 2`)).toBeTruthy();
  });

  it("buying food adds to the bag without eating it, and stacks", async () => {
    const screen = await mountShop();
    fireEvent.press(screen.getByLabelText("Food"));
    const buy = screen.getByLabelText(
      `Buy ${granola.name}, ${granola.price} points`,
    );
    fireEvent.press(buy);
    fireEvent.press(buy);

    expect(
      useStoreStore.getState().byMonster.nilly.owned[granola.id].quantity,
    ).toBe(2);
    expect(usePlayerStore.getState().spentPoints).toBe(granola.price * 2);
    expect(usePetStore.getState().byMonster.nilly.health).toBe(50);
    expect(screen.getByText("2 in the bag")).toBeTruthy();
    expect(screen.getByText(`${granola.name} — in the bag.`)).toBeTruthy();
  });

  it("a collectible is bought once, then shown as owned with no buy button", async () => {
    const screen = await mountShop();
    fireEvent.press(screen.getByLabelText("Plants"));
    const label = `Buy ${sunflower.name}, ${sunflower.price} points`;
    fireEvent.press(screen.getByLabelText(label));
    expect(
      useStoreStore.getState().byMonster.nilly.owned[sunflower.id].quantity,
    ).toBe(1);
    expect(screen.queryByLabelText(label)).toBeNull();
    expect(screen.getByText("In collection")).toBeTruthy();
    expect(usePlayerStore.getState().spentPoints).toBe(sunflower.price);
  });

  it("a level-locked item is visible, states its level, and cannot be bought", async () => {
    const screen = await mountShop();
    fireEvent.press(screen.getByLabelText("Toys"));
    expect(screen.getByText(crown.name)).toBeTruthy();
    const locked = screen.getByLabelText(
      `${crown.name}, ${crown.price} points, opens at level ${crown.unlock!.level}`,
    );
    expect(locked.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(locked);
    expect(useStoreStore.getState().byMonster.nilly.owned[crown.id]).toBeUndefined();
    expect(usePlayerStore.getState().spentPoints).toBe(0);
    expect(
      screen.getByText(new RegExp(`Opens at level ${crown.unlock!.level}`)),
    ).toBeTruthy();
  });

  it("the same item is buyable once the monster's level is reached", async () => {
    const screen = await mountShop("nilly", xpForLevel(crown.unlock!.level));
    fireEvent.press(screen.getByLabelText("Toys"));
    fireEvent.press(
      screen.getByLabelText(`Buy ${crown.name}, ${crown.price} points`),
    );
    expect(
      useStoreStore.getState().byMonster.nilly.owned[crown.id].quantity,
    ).toBe(1);
  });
});
