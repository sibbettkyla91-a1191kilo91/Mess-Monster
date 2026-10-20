/**
 * The Care settings sheet is the quiet house-rules door: reminders, privacy,
 * and a way to write us. It must not grant premium or write before hydration.
 */
import { act, fireEvent, render } from "@testing-library/react-native";

import HomeScreen from "@/app/(tabs)/index";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { requestNudgePermission } from "@/utils/daily-nudge";

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
  requestNudgePermission: jest.fn().mockResolvedValue(true),
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

async function flushHydration() {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("Care settings", () => {
  it("opens from Home and shows privacy without leaving the phone", async () => {
    usePlayerStore.setState({
      isPremium: false,
      selectedMonster: "nilly",
      monsterName: "Pip",
      hasCompletedOnboarding: true,
    });
    usePetStore.setState({
      lastSessionAt: Date.now(),
      lastCaredAt: Date.now(),
    });

    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });

    fireEvent.press(screen.getByLabelText("Open care settings"));
    expect(screen.getByLabelText("Care settings")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Read the privacy note"));
    expect(screen.getByLabelText("Privacy note")).toBeTruthy();
    expect(
      screen.getByText(/Your chores, points, and monster live on this phone/),
    ).toBeTruthy();
  });

  it("asks for evening reminders through the existing permission helper", async () => {
    usePlayerStore.setState({
      selectedMonster: "nilly",
      monsterName: "Pip",
      notifPermissionAsked: false,
    });
    usePetStore.setState({
      lastSessionAt: Date.now(),
      lastCaredAt: Date.now(),
    });

    const screen = render(<HomeScreen />);
    await act(async () => {
      await flushHydration();
    });

    fireEvent.press(screen.getByLabelText("Open care settings"));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Allow evening reminders"));
    });

    expect(requestNudgePermission).toHaveBeenCalled();
    expect(usePlayerStore.getState().notifPermissionAsked).toBe(true);
    expect(screen.getByText(/Evening reminders are on/)).toBeTruthy();
  });
});
