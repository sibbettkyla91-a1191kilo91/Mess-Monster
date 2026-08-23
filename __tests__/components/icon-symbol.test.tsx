/**
 * The Collection tab asks for the SF Symbol "sparkles". iOS passes that name
 * straight to SymbolView, but Android and web have to translate it through
 * IconSymbol's Material Icons table — and an unmapped name fails silently
 * rather than loudly: the glyph lookup resolves to an empty string, so the tab
 * renders blank space. Hence a guard on the mapping.
 *
 * jest-expo resolves the iOS platform by default, so the Android/web module is
 * required by exact path — that is the file that owns the mapping table.
 */
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { render } from "@testing-library/react-native";

// Stand in for the icon set so the assertion is about the name handed to it,
// not about expo-font's asynchronous glyph loading.
jest.mock("@expo/vector-icons/MaterialIcons", () => ({
  __esModule: true,
  default: function MaterialIcons() {
    return null;
  },
}));

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const { IconSymbol } = require("@/components/ui/icon-symbol.tsx");

/** The Material glyph name IconSymbol hands to MaterialIcons for a symbol. */
function materialGlyphFor(name: string) {
  const screen = render(<IconSymbol name={name} size={28} color="#000000" />);
  return screen.UNSAFE_getByType(MaterialIcons).props.name;
}

describe("IconSymbol on Android and web", () => {
  it("maps the sparkles symbol used by the Collection tab", () => {
    expect(materialGlyphFor("sparkles")).toBe("auto-awesome");
  });

  it("still maps an already-supported symbol", () => {
    expect(materialGlyphFor("bag.fill")).toBe("shopping-bag");
  });
});
