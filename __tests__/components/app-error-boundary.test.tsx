import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { AppErrorBoundary } from "@/components/app-error-boundary";

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("boom");
  }
  return <Text>All good</Text>;
}

describe("AppErrorBoundary", () => {
  const consoleError = console.error;

  beforeEach(() => {
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = consoleError;
  });

  it("shows a restart screen when a child throws, then remounts on tap", () => {
    const screenRender = render(
      <AppErrorBoundary>
        <Boom shouldThrow />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.queryByText("All good")).toBeNull();

    screenRender.rerender(
      <AppErrorBoundary>
        <Boom shouldThrow={false} />
      </AppErrorBoundary>,
    );
    fireEvent.press(screen.getByLabelText("Tap to restart"));

    expect(screen.getByText("All good")).toBeTruthy();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });
});
