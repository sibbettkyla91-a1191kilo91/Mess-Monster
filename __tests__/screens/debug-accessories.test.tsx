import { render } from "@testing-library/react-native";

import DebugSpritesScreen from "@/app/(tabs)/debug-sprites";

jest.mock("@react-native-community/slider", () => {
  const { View } = require("react-native");
  return function Slider(props: { accessibilityLabel?: string }) {
    return <View accessibilityLabel={props.accessibilityLabel} />;
  };
});

describe("Tune accessories screen", () => {
  it("shows a live preview and a copy-pasteable anchor block", () => {
    const screen = render(<DebugSpritesScreen />);
    expect(screen.getByText("Tune accessories")).toBeTruthy();
    expect(screen.getByLabelText("anchor snippet").props.children).toContain(
      "[nilly / teen / head]",
    );
    expect(screen.getByLabelText("x slider")).toBeTruthy();
    expect(screen.getByLabelText("x value")).toBeTruthy();
  });
});
