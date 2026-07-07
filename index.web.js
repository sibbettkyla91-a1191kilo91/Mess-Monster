/**
 * Web entry point for webpack builds.
 *
 * expo-router is tightly coupled to Metro's file-system routing, so the web
 * build uses a standalone React Native Web component instead of the full
 * expo-router tree.  This gives CI a real bundle to verify while keeping the
 * native app unaffected.
 */
import { AppRegistry } from "react-native";
import App from "./web/App";

AppRegistry.registerComponent("mess-monster", () => App);
AppRegistry.runApplication("mess-monster", {
  rootTag: document.getElementById("root"),
  initialProps: {},
});
