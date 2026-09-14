/**
 * "Snap photo" hands control to the camera and only gets it back later. In
 * between, the task the tap was for can stop waiting on a photo — the day
 * rolls over and the roll resets, or a second tap already started the time
 * lock — and the camera itself can refuse to open. None of that may restart,
 * overwrite, or double-start a time lock, or escape as an unhandled promise.
 */
import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

import TasksScreen from "@/app/(tabs)/explore";
import { useTasksStore } from "@/store/use-tasks-store";
import { usePhotoStore } from "@/store/use-photo-store";

type CameraResult =
  { canceled: true } | { canceled: false; assets: { uri: string }[] };

const camera: {
  resolve?: (result: CameraResult) => void;
  reject?: (error: Error) => void;
  launches: number;
} = { launches: 0 };

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: "granted" }),
  launchCameraAsync: jest.fn(
    () =>
      new Promise((resolve, reject) => {
        camera.launches += 1;
        camera.resolve = resolve;
        camera.reject = reject;
      }),
  ),
}));

jest.mock("@/utils/daily-nudge", () => ({
  requestNudgePermission: jest.fn().mockResolvedValue(false),
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

let taskId: string;

beforeEach(async () => {
  camera.launches = 0;
  camera.resolve = undefined;
  camera.reject = undefined;
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await flush(); // every store's null read has landed: all hydrated
  taskId = useTasksStore.getState().dailyRoll[0].id;
  useTasksStore.setState({
    taskProgress: { [taskId]: { state: "pending_photo", hasPhoto: false } },
    pendingRewards: [],
    unsettledGrants: [],
  });
  usePhotoStore.setState({ photos: [] });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function openCamera(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByLabelText("Snap photo"));
  await flush(); // permission resolved; camera now open
}

describe("Snap photo", () => {
  it("starts the time lock with the photo when the task is still pending", async () => {
    const screen = render(<TasksScreen />);
    await openCamera(screen);

    await act(async () => {
      camera.resolve!({ canceled: false, assets: [{ uri: "file://done" }] });
    });
    await flush();

    const progress = useTasksStore.getState().taskProgress[taskId];
    expect(progress.state).toBe("waiting");
    expect(progress.hasPhoto).toBe(true);
    expect(progress.photoUri).toBe("file://done");
    expect(usePhotoStore.getState().photos).toHaveLength(1);
  });

  it("opens the camera once for a double tap", async () => {
    const screen = render(<TasksScreen />);
    fireEvent.press(screen.getByLabelText("Snap photo"));
    fireEvent.press(screen.getByLabelText("Snap photo"));
    await flush();

    expect(camera.launches).toBe(1);

    await act(async () => {
      camera.resolve!({ canceled: false, assets: [{ uri: "file://once" }] });
    });
    await flush();
    expect(useTasksStore.getState().taskProgress[taskId].state).toBe("waiting");
  });

  it("does not overwrite a time lock that started while the camera was open", async () => {
    const screen = render(<TasksScreen />);
    await openCamera(screen);

    // Meanwhile the wait began (e.g. "Skip photo" landed on another tap).
    const startedAt = Date.now() - 60_000;
    act(() => {
      useTasksStore.getState().setTaskProgress(taskId, {
        state: "waiting",
        hasPhoto: false,
        waitStartedAt: startedAt,
      });
    });

    await act(async () => {
      camera.resolve!({ canceled: false, assets: [{ uri: "file://late" }] });
    });
    await flush();

    const progress = useTasksStore.getState().taskProgress[taskId];
    expect(progress.waitStartedAt).toBe(startedAt);
    expect(progress.hasPhoto).toBe(false);
    // The photo itself is still theirs.
    expect(usePhotoStore.getState().photos[0]?.photoUri).toBe("file://late");
  });

  it("does not resurrect a task the day rolled away from", async () => {
    const screen = render(<TasksScreen />);
    await openCamera(screen);

    // Midnight: the roll reset and this task's progress is gone.
    act(() => {
      useTasksStore.setState({ taskProgress: {} });
    });

    await act(async () => {
      camera.resolve!({ canceled: false, assets: [{ uri: "file://old" }] });
    });
    await flush();

    expect(useTasksStore.getState().taskProgress[taskId]).toBeUndefined();
  });

  it("tells the player when the camera cannot open, and lets them try again", async () => {
    const screen = render(<TasksScreen />);
    await openCamera(screen);

    await act(async () => {
      camera.reject!(new Error("Camera unavailable"));
    });
    await flush();

    expect(Alert.alert).toHaveBeenCalledWith(
      "Camera",
      expect.stringContaining("couldn't open"),
      expect.anything(),
    );
    expect(useTasksStore.getState().taskProgress[taskId].state).toBe(
      "pending_photo",
    );

    // Not stuck busy: a retry opens the camera again.
    await openCamera(screen);
    expect(camera.launches).toBe(2);
  });
});
