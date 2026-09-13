import "@testing-library/jest-native/extend-expect";

// Mock expo modules
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => "/"),
}));

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  wrap: (component) => component,
  captureException: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
}));

// Global test utilities
global.__DEV__ = true;
