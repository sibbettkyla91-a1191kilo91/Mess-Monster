import { Component, ErrorInfo, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * App-shell safety net. A JS throw in any screen used to white-screen
 * with no way back. Tap remounts the tree; saved progress is untouched.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error("AppErrorBoundary", error, info.componentStack);
    }
  }

  handleRestart = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.screen} accessibilityRole="alert">
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            Your progress is safe. Tap below to try again.
          </Text>
          <Pressable
            onPress={this.handleRestart}
            accessibilityRole="button"
            accessibilityLabel="Tap to restart"
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Tap to restart</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    backgroundColor: "#0f1412",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f4f7f5",
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: "#f4f7f5",
    opacity: 0.7,
    textAlign: "center",
    marginBottom: 28,
  },
  button: {
    backgroundColor: "#52b788",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  pressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#0f1412",
    fontSize: 16,
    fontWeight: "700",
  },
});
