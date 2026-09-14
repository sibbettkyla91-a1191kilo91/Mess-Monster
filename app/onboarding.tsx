import { Redirect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHasHydrated } from "@/hooks/use-has-hydrated";
import { LUNA_PALETTE, NILLY_PALETTE } from "@/monster-theme";
import { randomMonsterName } from "@/store/name-randomizer";
import { usePlayerStore } from "@/store/use-player-store";

const { width: W } = Dimensions.get("window");
const TOTAL_SLIDES = 3;

const HOW_STEPS = [
  {
    mark: "01",
    title: "Log the work you already did",
    body: "A dish, a load of laundry, five minutes on the floor. Points follow.",
  },
  {
    mark: "02",
    title: "Spend them on your monster",
    body: "Food, toys, a scarf. The shop is for them — not a gold star for you.",
  },
  {
    mark: "03",
    title: "They grow as the house does",
    body: "Miss a day? Nothing breaks. Pick it up when you can.",
  },
];

function WelcomeSlide({ onNext }: { onNext: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.slide, { width: W, paddingTop: insets.top + 8 }]}>
      <View style={s.slideBody}>
        <Text style={s.eyebrow}>A creature-care companion</Text>
        <Text style={s.appTitle}>Mess{"\n"}Monster</Text>
        <Text style={s.tagline}>
          Take care of your space.{"\n"}Your monster grows with you.
        </Text>
        <Text style={s.caption}>
          Two companions. One house. No charts, no lectures — just a creature
          that notices when the room gets easier.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [s.btn, { opacity: pressed ? 0.72 : 1 }]}
        onPress={onNext}
      >
        <Text style={s.btnText}>Continue</Text>
      </Pressable>
    </View>
  );
}

function HowSlide({ onNext }: { onNext: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.slide, { width: W, paddingTop: insets.top + 8 }]}>
      <View style={s.slideBody}>
        <Text style={s.slideHeading}>How it works</Text>

        <View style={how.list}>
          {HOW_STEPS.map((step) => (
            <View key={step.mark} style={how.row}>
              <Text style={how.mark}>{step.mark}</Text>
              <View style={how.text}>
                <Text style={how.title}>{step.title}</Text>
                <Text style={how.desc}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.note}>
          Low pressure. Zero shame.{"\n"}
          Come back whenever you&apos;re ready.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [s.btn, { opacity: pressed ? 0.72 : 1 }]}
        onPress={onNext}
      >
        <Text style={s.btnText}>Choose a companion</Text>
      </Pressable>
    </View>
  );
}

function ChooseSlide({
  onChoose,
}: {
  onChoose: (m: "nilly" | "luna", name: string) => void;
}) {
  const [selected, setSelected] = useState<"nilly" | "luna" | null>(null);
  const [nameVal, setNameVal] = useState("");

  const insets = useSafeAreaInsets();

  const handleSelect = (m: "nilly" | "luna") => {
    setSelected(m);
    setNameVal(randomMonsterName(m));
  };

  return (
    <View style={[s.slide, { width: W, paddingTop: insets.top + 8 }]}>
      <View style={s.slideBody}>
        <Text style={s.slideHeading}>Who lives{"\n"}with you?</Text>

        <View style={pick.row}>
          <Pressable
            style={({ pressed }) => [
              pick.card,
              pick.nillyCard,
              selected === "nilly" && pick.cardSelected,
              pressed && pick.cardPressed,
            ]}
            onPress={() => handleSelect("nilly")}
            accessibilityRole="button"
            accessibilityLabel="Choose Nilly"
          >
            <Image
              source={require("../assets/images/nilly_adult.png")}
              style={pick.img}
              resizeMode="contain"
            />
            <Text style={[pick.name, { color: NILLY_PALETTE.ink }]}>Nilly</Text>
            <Text style={[pick.tagline, { color: NILLY_PALETTE.text }]}>
              Warm. Sunlit. Soft.
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              pick.card,
              pick.lunaCard,
              selected === "luna" && pick.cardSelected,
              pressed && pick.cardPressed,
            ]}
            onPress={() => handleSelect("luna")}
            accessibilityRole="button"
            accessibilityLabel="Choose Luna"
          >
            <Image
              source={require("../assets/images/luna_adult.png")}
              style={pick.img}
              resizeMode="contain"
            />
            <Text style={[pick.name, { color: LUNA_PALETTE.ink }]}>Luna</Text>
            <Text style={[pick.tagline, { color: LUNA_PALETTE.particle }]}>
              Night-sided. Witchy.
            </Text>
          </Pressable>
        </View>

        {selected !== null && (
          <View style={ni.container}>
            <Text style={ni.label}>Their name</Text>
            <View style={ni.row}>
              <TextInput
                value={nameVal}
                onChangeText={setNameVal}
                style={ni.input}
                maxLength={20}
                placeholderTextColor="rgba(255,255,255,0.35)"
                selectionColor="#ffffff"
                autoCorrect={false}
              />
              <Pressable
                style={({ pressed }) => [
                  ni.diceBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                onPress={() => setNameVal(randomMonsterName(selected))}
                accessibilityLabel="Random name"
              >
                <Text style={ni.diceText}>↻</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {selected !== null && (
        <Pressable
          style={({ pressed }) => [s.btn, { opacity: pressed ? 0.72 : 1 }]}
          onPress={() =>
            onChoose(selected, nameVal.trim() || randomMonsterName(selected))
          }
        >
          <Text style={s.btnText}>Begin</Text>
        </Pressable>
      )}
    </View>
  );
}

function ProgressDots({ total, active }: { total: number; active: number }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[dots.dot, i === active && dots.activeDot]} />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const selectMonster = usePlayerStore((s) => s.selectMonster);
  const setMonsterName = usePlayerStore((s) => s.setMonsterName);
  const completeOnboarding = usePlayerStore((s) => s.completeOnboarding);
  const hasCompletedOnboarding = usePlayerStore(
    (s) => s.hasCompletedOnboarding,
  );
  // Renders nothing until the player store rehydrates: choosing a monster
  // before the merge landed would be clobbered, and the completed-onboarding
  // redirect can't be decided from pre-hydration defaults.
  const hydrated = useHasHydrated(usePlayerStore);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  if (!hydrated) return null;
  if (hasCompletedOnboarding) return <Redirect href="/(tabs)" />;

  const goTo = (i: number) => {
    setPage(i);
    scrollRef.current?.scrollTo({ x: i * W, animated: true });
  };

  const goNext = () => goTo(Math.min(page + 1, TOTAL_SLIDES - 1));

  const choose = (monster: "nilly" | "luna", name: string) => {
    selectMonster(monster);
    setMonsterName(name);
    completeOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: W * TOTAL_SLIDES }}
      >
        <WelcomeSlide onNext={goNext} />
        <HowSlide onNext={goNext} />
        <ChooseSlide onChoose={choose} />
      </ScrollView>

      <View style={s.dotsArea}>
        <ProgressDots total={TOTAL_SLIDES} active={page} />
      </View>
    </View>
  );
}

// ─── Shared slide styles ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0c0a12",
  },

  slide: {
    flex: 1,
    backgroundColor: "#0c0a12",
    paddingHorizontal: 28,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  slideBody: {
    flex: 1,
    justifyContent: "center",
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(232,184,109,0.75)",
    marginBottom: 18,
  },
  appTitle: {
    fontSize: 64,
    fontWeight: "800",
    color: "#f4efe6",
    letterSpacing: -1.4,
    lineHeight: 68,
    marginBottom: 20,
  },
  tagline: {
    fontSize: 22,
    fontWeight: "600",
    color: "rgba(244,239,230,0.88)",
    lineHeight: 30,
    marginBottom: 16,
  },
  caption: {
    fontSize: 16,
    color: "rgba(244,239,230,0.52)",
    lineHeight: 24,
  },

  slideHeading: {
    fontSize: 34,
    fontWeight: "800",
    color: "#f4efe6",
    letterSpacing: -0.4,
    lineHeight: 40,
    marginBottom: 28,
  },

  note: {
    fontSize: 14,
    color: "rgba(244,239,230,0.42)",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 28,
  },

  btn: {
    backgroundColor: "#f4efe6",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0c0a12",
    letterSpacing: 0.2,
  },

  dotsArea: {
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    alignItems: "center",
  },
});

const how = StyleSheet.create({
  list: {
    gap: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  mark: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(232,184,109,0.8)",
    width: 28,
    paddingTop: 3,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f4efe6",
    marginBottom: 4,
  },
  desc: {
    fontSize: 14,
    color: "rgba(244,239,230,0.52)",
    lineHeight: 20,
  },
});

const CARD_W = (W - 28 * 2 - 12) / 2;

const pick = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    width: CARD_W,
    borderRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 16,
    alignItems: "center",
    gap: 4,
  },
  nillyCard: {
    backgroundColor: NILLY_PALETTE.accentSoft,
  },
  lunaCard: {
    backgroundColor: LUNA_PALETTE.surface,
    borderWidth: 1,
    borderColor: LUNA_PALETTE.line,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: "rgba(244,239,230,0.7)",
  },
  cardPressed: {
    opacity: 0.78,
  },
  img: {
    width: CARD_W - 8,
    height: Math.round((CARD_W - 8) * 1.35),
    marginBottom: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 12,
    fontWeight: "500",
  },
});

const ni = StyleSheet.create({
  container: {
    marginTop: 24,
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: "rgba(244,239,230,0.45)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(244,239,230,0.06)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "600",
    color: "#f4efe6",
    borderWidth: 1,
    borderColor: "rgba(244,239,230,0.16)",
  },
  diceBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(244,239,230,0.06)",
    borderWidth: 1,
    borderColor: "rgba(244,239,230,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  diceText: {
    fontSize: 20,
    color: "#f4efe6",
  },
});

const dots = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(244,239,230,0.22)",
  },
  activeDot: {
    backgroundColor: "#f4efe6",
    width: 20,
    borderRadius: 4,
  },
});
