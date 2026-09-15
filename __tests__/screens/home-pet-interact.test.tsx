import { act, fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";

import HomeScreen from "@/app/(tabs)/index";
import { STORE_ITEMS } from "@/store/store-items";
import { usePetStore } from "@/store/use-pet-store";
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

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: mockNavigate, replace: jest.fn() }),
}));

jest.mock("@/utils/daily-nudge", () => ({
  requestNudgePermission: jest.fn().mockResolvedValue(false),
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

const cookie = STORE_ITEMS.find((i) => i.id === "nilly-food-granola-honey-bar")!;
const yarn = STORE_ITEMS.find((i) => i.id === "nilly-toy-tie-dye-yarn-ball")!;

async function flushHydration() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function seedHome() {
  usePlayerStore.setState({
    selectedMonster: "nilly",
    monsterName: "Nilly",
    totalPoints: 100,
    spentPoints: 0,
    lastTapReactionDate: "",
    tapReactionCount: 0,
  });
  usePetStore.setState({
    health: 50,
    happiness: 50,
    lastSessionAt: Date.now(),
    lastCaredAt: Date.now(),
    evolutionStage: "baby",
    pendingEvolution: null,
    pendingPremiumGate: null,
    pendingMilestoneBanner: null,
  });
  useStoreStore.setState({
    owned: {},
    placed: {},
    equipped: {},
  });
}

describe("Home care menu", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  it("opens Feed / Play / Pet instead of petting on the first tap", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => seedHome());

    fireEvent.press(screen.getByLabelText("Care for Nilly"));
    expect(screen.getByLabelText("Feed Nilly")).toBeTruthy();
    expect(screen.getByLabelText("Play with Nilly")).toBeTruthy();
    expect(screen.getByLabelText("Pet Nilly")).toBeTruthy();
    expect(usePetStore.getState().happiness).toBe(50);
  });

  it("prompts the shop when the bag has no food", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => seedHome());

    fireEvent.press(screen.getByLabelText("Care for Nilly"));
    fireEvent.press(screen.getByLabelText("Feed Nilly"));
    expect(
      screen.getByText(/No snacks in Nilly's bag yet/),
    ).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Visit the points store"));
    expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/store");
  });

  it("lets the player pick a snack and consumes only that one", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => {
      seedHome();
      useStoreStore.getState().buyItem(cookie);
      useStoreStore.getState().buyItem(STORE_ITEMS.find((i) => i.id === "nilly-food-herbal-sun-tea")!);
    });

    fireEvent.press(screen.getByLabelText("Care for Nilly"));
    fireEvent.press(screen.getByLabelText("Feed Nilly"));
    fireEvent.press(screen.getByLabelText("Feed Herbal Sun Tea"));

    expect(useStoreStore.getState().owned["nilly-food-herbal-sun-tea"].quantity).toBe(0);
    expect(useStoreStore.getState().owned["nilly-food-granola-honey-bar"].quantity).toBe(1);
    expect(usePetStore.getState().health).toBe(58);
    expect(usePetStore.getState().happiness).toBe(58);
  });

  it("plays with a chosen toy without consuming it", async () => {
    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });
    act(() => {
      seedHome();
      useStoreStore.getState().buyItem(yarn);
    });

    fireEvent.press(screen.getByLabelText("Care for Nilly"));
    fireEvent.press(screen.getByLabelText("Play with Nilly"));
    fireEvent.press(screen.getByLabelText("Play with Tie-Dye Yarn Ball"));

    expect(useStoreStore.getState().owned["nilly-toy-tie-dye-yarn-ball"].quantity).toBe(1);
    expect(usePetStore.getState().happiness).toBe(58);
    expect(usePetStore.getState().health).toBe(53);
  });
});
