import React, { useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api, type Ticket } from "../api";
import { Card, ChipBadge, Pill } from "../components";
import { useAsync } from "../hooks";
import { colors } from "../theme";

interface Batch {
  batchId: string;
  poolId: string;
  chipColor: Ticket["chipColor"];
  seats: number;
  createdAt: number;
  ticketId: string;
}

export default function TicketsScreen() {
  const { data, error, loading, reload } = useAsync(() => api.tickets());

  const batches = useMemo(() => groupBatches(data ?? []), [data]);

  return (
    <View style={styles.flex}>
      <FlatList
        data={batches}
        keyExtractor={(b) => b.batchId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Your Tickets</Text>
            <Text style={styles.subtitle}>Immutable seats dropped on the floor.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No tickets yet. Drop a chip on a pool to claim seats.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <ChipBadge color={item.chipColor} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pool}>{item.poolId}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
              <Text style={styles.ticketId}>{item.ticketId}</Text>
            </View>
            <Pill text={`${item.seats} seat${item.seats > 1 ? "s" : ""}`} tone="accent" />
          </Card>
        )}
      />
    </View>
  );
}

function groupBatches(tickets: Ticket[]): Batch[] {
  const map = new Map<string, Batch>();
  for (const t of tickets) {
    const existing = map.get(t.batchId);
    if (existing) {
      existing.seats += 1;
    } else {
      map.set(t.batchId, {
        batchId: t.batchId,
        poolId: t.poolId,
        chipColor: t.chipColor,
        seats: 1,
        createdAt: t.createdAt,
        ticketId: t.id.split("#")[0] ?? t.id,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, gap: 12 },
  header: { marginBottom: 4 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginTop: 4 },
  error: { color: colors.danger, marginTop: 8, fontWeight: "600" },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 40 },
  card: { flexDirection: "row", alignItems: "center", gap: 14 },
  pool: { color: colors.text, fontSize: 16, fontWeight: "800" },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  ticketId: { color: colors.border, fontSize: 11, marginTop: 4 },
});
