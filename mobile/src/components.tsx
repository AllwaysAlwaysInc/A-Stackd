import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { CHIP_META, colors } from "./theme";
import type { ChipColor } from "./api";

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading ? styles.buttonPressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.accentText : colors.text} />
      ) : (
        <Text style={[styles.buttonText, isPrimary ? styles.buttonTextPrimary : styles.buttonTextGhost]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function ChipBadge({ color, count, size = 44 }: { color: ChipColor; count?: number; size?: number }) {
  const meta = CHIP_META[color];
  return (
    <View style={{ alignItems: "center" }}>
      <View
        style={[
          styles.chip,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: meta.swatch,
            borderColor: color === "black" ? meta.ink : "rgba(255,255,255,0.25)",
          },
        ]}
      >
        <Text style={[styles.chipValue, { color: meta.ink, fontSize: size * 0.3 }]}>${meta.value}</Text>
      </View>
      {count !== undefined ? <Text style={styles.chipCount}>{count}</Text> : null}
    </View>
  );
}

export function Pill({ text, tone = "muted" }: { text: string; tone?: "muted" | "accent" | "success" }) {
  const toneStyle =
    tone === "accent" ? styles.pillAccent : tone === "success" ? styles.pillSuccess : styles.pillMuted;
  const textStyle =
    tone === "accent" ? styles.pillTextAccent : tone === "success" ? styles.pillTextSuccess : styles.pillTextMuted;
  return (
    <View style={[styles.pill, toneStyle]}>
      <Text style={[styles.pillText, textStyle]}>{text}</Text>
    </View>
  );
}

export function Banner({ text }: { text: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  button: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  buttonTextPrimary: { color: colors.accentText },
  buttonTextGhost: { color: colors.text },
  chip: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  chipValue: { fontWeight: "800" },
  chipCount: { color: colors.text, fontWeight: "700", marginTop: 6, fontSize: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" },
  pillMuted: { backgroundColor: colors.surfaceAlt },
  pillAccent: { backgroundColor: "rgba(247,181,0,0.15)" },
  pillSuccess: { backgroundColor: "rgba(52,199,89,0.15)" },
  pillText: { fontSize: 12, fontWeight: "700" },
  pillTextMuted: { color: colors.textMuted },
  pillTextAccent: { color: colors.accent },
  pillTextSuccess: { color: colors.success },
  banner: {
    backgroundColor: "rgba(247,181,0,0.12)",
    borderColor: "rgba(247,181,0,0.4)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  bannerText: { color: colors.accent, fontWeight: "600", fontSize: 13 },
});
