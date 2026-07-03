import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
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
} from 'react-native';

import { randomMonsterName } from '@/store/name-randomizer';
import { usePlayerStore } from '@/store/use-player-store';

const { width: W } = Dimensions.get('window');
const TOTAL_SLIDES = 3;

// ─── How-it-works content ────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    emoji: '🧹',
    title: 'Log a cleaning task',
    body: 'Pick from presets whenever you tidy up. Every task earns you points.',
  },
  {
    emoji: '⭐',
    title: 'Spend in the store',
    body: 'Buy snacks, toys, and potions to keep your monster happy and fed.',
  },
  {
    emoji: '🌱',
    title: 'Keep your space going',
    body: 'Clean consistently and your monster thrives. Miss a day? No shame — just keep going.',
  },
];

// ─── Slide 0 — Welcome ───────────────────────────────────────────────────────

function WelcomeSlide({ onNext }: { onNext: () => void }) {
  return (
    <View style={[s.slide, { width: W }]}>
      <View style={s.slideBody}>
        <Text style={s.appTitle}>Mess{'\n'}Monster</Text>
        <Text style={s.tagline}>
          Your mess is your{'\n'}monster&apos;s fuel.
        </Text>
        <Text style={s.caption}>
          A tiny creature lives in your phone.{'\n'}
          The cleaner your space, the happier it gets.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [s.btn, { opacity: pressed ? 0.72 : 1 }]}
        onPress={onNext}
      >
        <Text style={s.btnText}>Let&apos;s go  →</Text>
      </Pressable>
    </View>
  );
}

// ─── Slide 1 — How it works ──────────────────────────────────────────────────

function HowSlide({ onNext }: { onNext: () => void }) {
  return (
    <View style={[s.slide, { width: W }]}>
      <View style={s.slideBody}>
        <Text style={s.slideHeading}>How it works</Text>

        <View style={how.list}>
          {HOW_STEPS.map((step, i) => (
            <View key={i} style={how.row}>
              <Text style={how.emoji}>{step.emoji}</Text>
              <View style={how.text}>
                <Text style={how.title}>{step.title}</Text>
                <Text style={how.desc}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.note}>
          Low pressure. Zero shame.{'\n'}
          Pick back up whenever you&apos;re ready. 🫶
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [s.btn, { opacity: pressed ? 0.72 : 1 }]}
        onPress={onNext}
      >
        <Text style={s.btnText}>Got it  →</Text>
      </Pressable>
    </View>
  );
}

// ─── Slide 2 — Choose your monster ───────────────────────────────────────────

function ChooseSlide({ onChoose }: { onChoose: (m: 'nilly' | 'luna', name: string) => void }) {
  const [selected, setSelected] = useState<'nilly' | 'luna' | null>(null);
  const [nameVal, setNameVal]   = useState('');

  const handleSelect = (m: 'nilly' | 'luna') => {
    setSelected(m);
    setNameVal(randomMonsterName(m));
  };

  return (
    <View style={[s.slide, { width: W }]}>
      <View style={s.slideBody}>
        <Text style={s.slideHeading}>Choose your{'\n'}monster</Text>

        <View style={pick.row}>
          {/* ── Nilly ── */}
          <Pressable
            style={({ pressed }) => [
              pick.card, pick.nillyCard,
              selected === 'nilly' && pick.cardSelected,
              pressed && pick.cardPressed,
            ]}
            onPress={() => handleSelect('nilly')}
            accessibilityRole="button"
            accessibilityLabel="Choose Nilly"
          >
            <Image
              source={require('../assets/images/nilly_adult.png')}
              style={pick.img}
              resizeMode="contain"
            />
            <Text style={[pick.name, { color: '#1a5c3a' }]}>Nilly</Text>
            <Text style={[pick.tagline, { color: '#52b788' }]}>kawaii & clean</Text>
          </Pressable>

          {/* ── Luna ── */}
          <Pressable
            style={({ pressed }) => [
              pick.card, pick.lunaCard,
              selected === 'luna' && pick.cardSelected,
              pressed && pick.cardPressed,
            ]}
            onPress={() => handleSelect('luna')}
            accessibilityRole="button"
            accessibilityLabel="Choose Luna"
          >
            <Image
              source={require('../assets/images/luna_adult.png')}
              style={pick.img}
              resizeMode="contain"
            />
            <Text style={[pick.name, { color: '#cc2222' }]}>Luna</Text>
            <Text style={[pick.tagline, { color: '#a78bfa' }]}>dark & witchy</Text>
          </Pressable>
        </View>

        {/* ── Name input — appears after monster is selected ── */}
        {selected !== null && (
          <View style={ni.container}>
            <Text style={ni.label}>Name your monster</Text>
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
                style={({ pressed }) => [ni.diceBtn, { opacity: pressed ? 0.7 : 1 }]}
                onPress={() => setNameVal(randomMonsterName(selected))}
                accessibilityLabel="Random name"
              >
                <Text style={ni.diceText}>🎲</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {selected !== null && (
        <Pressable
          style={({ pressed }) => [s.btn, { opacity: pressed ? 0.72 : 1 }]}
          onPress={() => onChoose(selected, nameVal.trim() || randomMonsterName(selected))}
        >
          <Text style={s.btnText}>Let&apos;s go  →</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Progress dots ───────────────────────────────────────────────────────────

function ProgressDots({ total, active }: { total: number; active: number }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[dots.dot, i === active && dots.activeDot]} />
      ))}
    </View>
  );
}

// ─── Root screen ─────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router             = useRouter();
  const selectMonster      = usePlayerStore((s) => s.selectMonster);
  const setMonsterName     = usePlayerStore((s) => s.setMonsterName);
  const completeOnboarding = usePlayerStore((s) => s.completeOnboarding);
  const hasCompletedOnboarding = usePlayerStore((s) => s.hasCompletedOnboarding);
  const [hydrated, setHydrated] = useState(() => usePlayerStore.persist.hasHydrated());
  const [page, setPage]         = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (hydrated) return;
    return usePlayerStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  if (!hydrated) return null;
  if (hasCompletedOnboarding) return <Redirect href="/(tabs)" />;

  const goTo = (i: number) => {
    setPage(i);
    scrollRef.current?.scrollTo({ x: i * W, animated: true });
  };

  const goNext = () => goTo(Math.min(page + 1, TOTAL_SLIDES - 1));

  const choose = (monster: 'nilly' | 'luna', name: string) => {
    selectMonster(monster);
    setMonsterName(name);
    completeOnboarding();
    router.replace('/(tabs)');
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
        <HowSlide    onNext={goNext} />
        <ChooseSlide onChoose={choose} />
      </ScrollView>

      <View style={s.dotsArea}>
        <ProgressDots total={TOTAL_SLIDES} active={page} />
      </View>
    </View>
  );
}

// ─── Shared slide styles ─────────────────────────────────────────────────────

const SLIDE_PT = Platform.OS === 'android' ? 52 : 68;

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0118',
  },

  // Each slide fills the width; content is top-aligned with flex
  slide: {
    flex: 1,
    backgroundColor: '#0d0118',
    paddingTop: SLIDE_PT,
    paddingHorizontal: 28,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  slideBody: {
    flex: 1,
    justifyContent: 'center',
  },

  // Slide 0 – hero type
  appTitle: {
    fontSize: 72,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
    lineHeight: 76,
    marginBottom: 24,
  },
  tagline: {
    fontSize: 26,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 34,
    marginBottom: 18,
  },
  caption: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 24,
  },

  // Slide 1 & 2 – section heading
  slideHeading: {
    fontSize: 38,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
    lineHeight: 46,
    marginBottom: 32,
  },

  // Shared note / disclaimer
  note: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 28,
    fontStyle: 'italic',
  },

  // CTA button — white pill at the bottom of every slide
  btn: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0d0118',
    letterSpacing: 0.3,
  },

  // Dots bar
  dotsArea: {
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    alignItems: 'center',
  },
});

// ─── How-it-works styles ─────────────────────────────────────────────────────

const how = StyleSheet.create({
  list: {
    gap: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  emoji: {
    fontSize: 32,
    lineHeight: 40,
    width: 40,
    textAlign: 'center',
  },
  text: {
    flex: 1,
    paddingTop: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  desc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
});

// ─── Monster-pick styles ─────────────────────────────────────────────────────

const CARD_W = (W - 28 * 2 - 12) / 2; // two cards with gap, respecting horizontal padding

const pick = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    width: CARD_W,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  nillyCard: {
    backgroundColor: '#c8f7da',
  },
  lunaCard: {
    backgroundColor: '#1a0a2a',
    borderWidth: 1,
    borderColor: '#3a1a4a',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  cardPressed: {
    opacity: 0.78,
  },
  img: {
    width: CARD_W - 32,
    height: CARD_W - 32,
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});

// ─── Name-input styles ────────────────────────────────────────────────────────

const ni = StyleSheet.create({
  container: {
    marginTop: 24,
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  diceBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceText: {
    fontSize: 22,
  },
});

// ─── Progress-dot styles ─────────────────────────────────────────────────────

const dots = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  activeDot: {
    backgroundColor: '#ffffff',
    width: 20,
    borderRadius: 4,
  },
});
