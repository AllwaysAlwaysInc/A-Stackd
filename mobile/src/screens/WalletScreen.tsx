import React from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Button, Card, ChipBadge } from "../components";
import { useAsync } from "../hooks";
import { CHIP_META, CHIP_ORDER, colors } from "../theme";

export default function WalletScreen() {
  const { session, logout } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.wallet());

  const stacks = data?.stacks;
  const totalValue = stacks
    ? CHIP_ORDER.reduce((sum, c) => sum + stacks[c] * CHIP_META[c].value, 0)
    : 0;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Your Stack</Text>
      <Text style={styles.subtitle}>{session?.userId}</Text>

      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Stack value</Text>
        <Text style={styles.totalValue}>${totalValue.toLocaleString()}</Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        {CHIP_ORDER.map((c) => (
          <Card key={c} style={styles.chipCard}>
            <ChipBadge color={c} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.chipName}>
                {CHIP_META[c].label} <Text style={styles.chipMood}>· {CHIP_META[c].mood}</Text>
              </Text>
              <Text style={styles.chipSeats}>
                ${CHIP_META[c].value} · {CHIP_META[c].seats} seat{CHIP_META[c].seats > 1 ? "s" : ""}
              </Text>
            </View>
            <Text style={styles.chipCount}>{stacks ? stacks[c] : "—"}</Text>
          </Card>
        ))}
      </View>

      <Text style={styles.note}>
        Chips are loaded by the house. A real payment top-up is coming soon.
      </Text>

      <View style={{ height: 12 }} />
      <Button title="Log out" variant="ghost" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: 4 },
  totalCard: { alignItems: "center", paddingVertical: 24 },
  totalLabel: { color: colors.textMuted, textTransform: "uppercase", fontSize: 12, fontWeight: "700" },
  totalValue: { color: colors.accent, fontSize: 44, fontWeight: "900", marginTop: 4 },
  error: { color: colors.danger, fontWeight: "600" },
  grid: { gap: 10 },
  chipCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  chipName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  chipMood: { color: colors.textMuted, fontWeight: "600" },
  chipSeats: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  chipCount: { color: colors.text, fontSize: 24, fontWeight: "900" },
  note: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 8 },
});
