/**
 * The Founding Member button must not grant premium while billing is off.
 */
import { act, fireEvent, render } from "@testing-library/react-native";

import HomeScreen from "@/app/(tabs)/index";
import { FOUNDING_MEMBER_PURCHASE_ENABLED } from "@/constants/feature-flags";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/utils/daily-nudge", () => ({
  requestNudgePermission: jest.fn().mockResolvedValue(false),
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

async function flushHydration() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("Founding Member purchase hole", () => {
  it("keeps the purchase flag off until billing is wired", () => {
    expect(FOUNDING_MEMBER_PURCHASE_ENABLED).toBe(false);
  });

  it("shows Coming soon and does not grant premium when the CTA is pressed", async () => {
    usePlayerStore.setState({
      isPremium: false,
      selectedMonster: "nilly",
      monsterName: "Nilly",
    });
    usePetStore.setState({
      lastSessionAt: Date.now(),
      lastCaredAt: Date.now(),
      pendingPremiumGate: null,
    });

    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });

    fireEvent.press(screen.getByLabelText("Learn about Founding Member"));
    fireEvent.press(screen.getByLabelText("Founding Member coming soon"));

    expect(usePlayerStore.getState().isPremium).toBe(false);
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.getByText("Adult form — plus a secret final form to discover")).toBeTruthy();
  });
});
