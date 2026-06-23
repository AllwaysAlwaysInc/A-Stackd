import { useNavigation } from "@react-navigation/native";
import React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, type Pool } from "../api";
import { Banner, Card, Pill } from "../components";
import { useAsync } from "../hooks";
import type { RootStackNavProp } from "../navigation";
import { CHIP_META, colors } from "../theme";

export default function PoolsScreen() {
  const navigation = useNavigation<RootStackNavProp>();
  const { data, error, loading, reload } = useAsync(() => api.activePools());

  return (
    <View style={styles.flex}>
      <FlatList
        data={data ?? []}
        keyExtractor={(p) => p.poolId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Active Pools</Text>
            <Text style={styles.subtitle}>Tap a pool to drop chips on the floor.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No active pools right now. Pull to refresh.</Text> : null
        }
        renderItem={({ item }) => (
          <PoolCard pool={item} onPress={() => navigation.navigate("PoolDetail", { poolId: item.poolId })} />
        )}
      />
    </View>
  );
}

function PoolCard({ pool, onPress }: { pool: Pool; onPress: () => void }) {
  const chip = CHIP_META[pool.requiredChip];
  const drawn = pool.drawnAt !== undefined;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prize}>{pool.prize}</Text>
            <View style={styles.row}>
              <Pill text={pool.type.replace("_", " ")} />
              {pool.isGuaranteed ? <Pill text="Guaranteed" tone="success" /> : null}
              {drawn ? <Pill text="Drawn" tone="accent" /> : null}
            </View>
          </View>
          <View style={[styles.multiplier, { borderColor: colors.accent }]}>
            <Text style={styles.multiplierValue}>{pool.meltingMultiplier}x</Text>
            <Text style={styles.multiplierLabel}>odds</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>{pool.status}</Text>
          <Text style={styles.meta}>·</Text>
          <Text style={styles.meta}>{pool.timeLeft}</Text>
          <Text style={styles.meta}>·</Text>
          <Text style={[styles.meta, { color: chip.swatch === "#000000" ? colors.accent : chip.swatch }]}>
            {chip.label} chip
          </Text>
        </View>

        {pool.salesAgentAlert ? <Banner text={pool.salesAgentAlert} /> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, gap: 14 },
  header: { marginBottom: 4 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 8 },
  error: { color: colors.danger, marginTop: 8, fontWeight: "600" },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 40 },
  card: { gap: 12 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  prize: { color: colors.text, fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  multiplier: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    minWidth: 56,
  },
  multiplierValue: { color: colors.accent, fontSize: 18, fontWeight: "900" },
  multiplierLabel: { color: colors.textMuted, fontSize: 10, textTransform: "uppercase" },
  metaRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  meta: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
});
