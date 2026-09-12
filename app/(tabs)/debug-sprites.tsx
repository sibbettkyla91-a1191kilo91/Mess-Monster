import Slider from "@react-native-community/slider";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AccessoryLayer } from "@/components/accessory-layer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  ACCESSORY_IDS,
  ACCESSORY_STAGES,
  AccessoryMonster,
  AccessoryStage,
  formatAnchorSnippet,
  getAccessoryDef,
  getSlotAnchor,
  SlotAnchor,
} from "@/store/accessory-config";
import { getMonsterSprite } from "@/store/monster-sprites";
import { STORE_ITEMS } from "@/store/store-items";

const PREVIEW = 240;

const MONSTERS: AccessoryMonster[] = ["nilly", "luna"];

type Field = keyof SlotAnchor;

const FIELDS: {
  key: Field;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "x", label: "x — left / right", min: 0, max: 1, step: 0.01 },
  { key: "y", label: "y — up / down", min: 0, max: 1, step: 0.01 },
  {
    key: "scale",
    label: "scale — size vs monster",
    min: 0.1,
    max: 1.2,
    step: 0.01,
  },
  {
    key: "rotation",
    label: "rotation — tilt (degrees)",
    min: -45,
    max: 45,
    step: 1,
  },
  {
    key: "zIndex",
    label: "zIndex — in front of other items",
    min: 0,
    max: 10,
    step: 1,
  },
];

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: (typeof FIELDS)[number];
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <ThemedText style={styles.fieldLabel}>{field.label}</ThemedText>
        <TextInput
          accessibilityLabel={`${field.key} value`}
          keyboardType="numeric"
          value={String(value)}
          onChangeText={(text) => {
            const n = Number(text);
            if (Number.isFinite(n)) onChange(n);
          }}
          style={styles.numberInput}
        />
      </View>
      <Slider
        minimumValue={field.min}
        maximumValue={field.max}
        step={field.step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor="#52b788"
        maximumTrackTintColor="#ccc"
        accessibilityLabel={`${field.key} slider`}
      />
    </View>
  );
}

export default function DebugSpritesScreen() {
  if (!__DEV__) {
    return null;
  }
  return <DebugSpritesTuner />;
}

function DebugSpritesTuner() {
  const [monster, setMonster] = useState<AccessoryMonster>("nilly");
  const [stage, setStage] = useState<AccessoryStage>("teen");
  const [itemId, setItemId] = useState("acc-bow");
  const slot = getAccessoryDef(itemId)?.slot ?? "head";
  const [anchor, setAnchor] = useState<SlotAnchor>(() =>
    getSlotAnchor("nilly", "teen", "head"),
  );

  useEffect(() => {
    setAnchor(getSlotAnchor(monster, stage, slot));
  }, [monster, stage, slot]);

  const equipped = useMemo(() => ({ [slot]: itemId }), [slot, itemId]);
  const overrides = useMemo(() => ({ [slot]: anchor }), [slot, anchor]);
  const snippet = formatAnchorSnippet(monster, stage, slot, anchor);
  const sprite = getMonsterSprite(monster, stage, "base", "happy");
  const itemName = STORE_ITEMS.find((i) => i.id === itemId)?.name ?? itemId;

  const setField = (key: Field, n: number) => {
    const spec = FIELDS.find((f) => f.key === key)!;
    const clamped = Math.min(spec.max, Math.max(spec.min, n));
    const rounded =
      spec.step >= 1 ? Math.round(clamped) : Math.round(clamped * 100) / 100;
    setAnchor((prev) => ({ ...prev, [key]: rounded }));
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="title">Tune accessories</ThemedText>
        <ThemedText style={styles.help}>
          Dev only. Nudge the numbers, then paste the block into
          store/accessory-config.ts. Luna&apos;s head lock is ignored here.
        </ThemedText>

        <View style={styles.previewBox}>
          <View style={{ width: PREVIEW, height: PREVIEW }}>
            <Image
              source={sprite}
              style={StyleSheet.absoluteFillObject}
              resizeMode="contain"
            />
            <AccessoryLayer
              monster={monster}
              stage={stage}
              equipped={equipped}
              size={PREVIEW}
              anchorOverrides={overrides}
            />
          </View>
        </View>

        <ThemedText style={styles.section}>Monster</ThemedText>
        <View style={styles.row}>
          {MONSTERS.map((id) => (
            <Chip
              key={id}
              label={id}
              active={monster === id}
              onPress={() => setMonster(id)}
            />
          ))}
        </View>

        <ThemedText style={styles.section}>Stage</ThemedText>
        <View style={styles.row}>
          {ACCESSORY_STAGES.map((id) => (
            <Chip
              key={id}
              label={id}
              active={stage === id}
              onPress={() => setStage(id)}
            />
          ))}
        </View>

        <ThemedText style={styles.section}>Accessory</ThemedText>
        <View style={styles.row}>
          {ACCESSORY_IDS.map((id) => (
            <Chip
              key={id}
              label={STORE_ITEMS.find((i) => i.id === id)?.name ?? id}
              active={itemId === id}
              onPress={() => setItemId(id)}
            />
          ))}
        </View>

        <ThemedText style={styles.section}>
          {itemName} · {slot}
        </ThemedText>
        {FIELDS.map((field) => (
          <FieldRow
            key={field.key}
            field={field}
            value={anchor[field.key]}
            onChange={(n) => setField(field.key, n)}
          />
        ))}

        <ThemedText style={styles.section}>Copy into config</ThemedText>
        <Text
          selectable
          style={styles.snippet}
          accessibilityLabel="anchor snippet"
        >
          {snippet}
        </Text>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 56 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  help: { fontSize: 13, opacity: 0.65, marginTop: 8, marginBottom: 16 },
  previewBox: {
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 16,
    marginBottom: 16,
  },
  section: { fontSize: 14, fontWeight: "700", marginTop: 12, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbb",
  },
  chipActive: { backgroundColor: "#52b788", borderColor: "#52b788" },
  chipText: { fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: "#0f1412" },
  field: { marginBottom: 8 },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fieldLabel: { fontSize: 13, opacity: 0.75, flex: 1 },
  numberInput: {
    width: 72,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: "right",
    fontSize: 14,
  },
  snippet: {
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 20,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 12,
  },
});
