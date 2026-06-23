import React, { useMemo, useState, useEffect } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Animated,
  Pressable,
} from "react-native";
import { api, type Ticket } from "../api";
import { Button, Card, ChipBadge, Pill } from "../components";
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

interface Particle {
  id: number;
  x: number;
  y: Animated.Value;
  rotate: string;
  color: string;
}

function ConfettiCelebration({ onComplete }: { onComplete: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colorsList = ["#FF3B30", "#FF9500", "#FFCC00", "#4CD964", "#5AC8FA", "#5856D6", "#FF2D55"];
    const pts: Particle[] = Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      x: Math.random() * 360,
      y: new Animated.Value(-50),
      rotate: `${Math.random() * 360}deg`,
      color: colorsList[Math.floor(Math.random() * colorsList.length)],
    }));
    setParticles(pts);

    const animations = pts.map((p) =>
      Animated.timing(p.y, {
        toValue: 900,
        duration: 1800 + Math.random() * 1500,
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start(() => {
      onComplete();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <Animated.View
          key={p.id}
          style={[
            styles.particle,
            {
              backgroundColor: p.color,
              left: p.x,
              transform: [
                { translateY: p.y },
                { rotate: p.rotate },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function SkeletonCard() {
  return (
    <Card style={StyleSheet.flatten([styles.card, { opacity: 0.25 }])}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt }} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ width: 140, height: 16, backgroundColor: colors.surfaceAlt, borderRadius: 4 }} />
        <View style={{ width: 90, height: 12, backgroundColor: colors.surfaceAlt, borderRadius: 4 }} />
      </View>
    </Card>
  );
}

export default function TicketsScreen() {
  const tickets = useAsync(() => api.tickets(), []);
  const notifications = useAsync(() => api.getNotifications(), []);

  const [showCongrats, setShowCongrats] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [congratsNotifMessage, setCongratsNotifMessage] = useState("");

  const batches = useMemo(() => groupBatches(tickets.data ?? []), [tickets.data]);

  // Check for unread Winner notifications to trigger celebration
  useEffect(() => {
    if (notifications.data?.notifications && !hasCelebrated) {
      const winNotif = notifications.data.notifications.find(
        (n) => !n.read && (n.title.toLowerCase().includes("winner") || n.message.toLowerCase().includes("winner") || n.title.includes("🏆"))
      );
      if (winNotif) {
        setCongratsNotifMessage(winNotif.message);
        setShowCongrats(true);
        setHasCelebrated(true);
      }
    }
  }, [notifications.data, hasCelebrated]);

  function reloadAll() {
    tickets.reload();
    notifications.reload();
  }

  async function dismissCongrats() {
    setShowCongrats(false);
    try {
      await api.markNotificationsRead();
      notifications.reload();
    } catch (e) {
      // ignore error
    }
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={batches}
        keyExtractor={(b) => b.batchId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={tickets.loading || notifications.loading} onRefresh={reloadAll} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Your Tickets</Text>
            <Text style={styles.subtitle}>Immutable seats dropped on the floor.</Text>
            
            {tickets.error ? <Text style={styles.error}>{tickets.error}</Text> : null}
            {notifications.error ? <Text style={styles.error}>{notifications.error}</Text> : null}

            {/* Inbox Section */}
            {notifications.data?.notifications && notifications.data.notifications.length > 0 && (
              <View style={styles.inboxSection}>
                <View style={styles.inboxHeader}>
                  <Text style={styles.sectionTitle}>Inbox Notices</Text>
                  {notifications.data.notifications.some((n) => !n.read) && (
                    <Pressable onPress={dismissCongrats}>
                      <Text style={styles.clearNotifsLink}>Mark all read</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.inboxList}>
                  {notifications.data.notifications.map((n) => {
                    const isWin = n.title.toLowerCase().includes("winner") || n.message.toLowerCase().includes("winner") || n.title.includes("🏆");
                    const isShip = n.title.toLowerCase().includes("shipped") || n.title.includes("📦");
                    return (
                      <Card
                        key={n.notification_id}
                        style={StyleSheet.flatten([
                          styles.notifCard,
                          isWin && styles.winCard,
                          isShip && styles.shipCard,
                          n.read && { opacity: 0.65 },
                        ])}
                      >
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={[styles.notifTitle, isWin && styles.winText, isShip && styles.shipText]}>
                            {n.title}
                          </Text>
                          <Text style={styles.notifMessage}>{n.message}</Text>
                          <Text style={styles.notifDate}>
                            {new Date(n.created_at).toLocaleString()}
                          </Text>
                        </View>
                        {!n.read && <View style={styles.unreadBadge} />}
                      </Card>
                    );
                  })}
                </View>
              </View>
            )}

            {batches.length > 0 && (
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Active Tickets</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          tickets.loading ? (
            <View style={{ gap: 12 }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <Text style={styles.empty}>No tickets yet. Drop a chip on a pool to claim seats.</Text>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <ChipBadge color={item.chipColor} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.pool}>{item.poolId.replace("p_", "").toUpperCase()}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
              <Text style={styles.ticketId}>Batch: {item.ticketId}</Text>
            </View>
            <Pill text={`${item.seats} seat${item.seats > 1 ? "s" : ""}`} tone="accent" />
          </Card>
        )}
      />

      {/* Confetti & congrats Modal */}
      {showCongrats && (
        <View style={styles.congratsModal}>
          <ConfettiCelebration onComplete={() => {}} />
          <Card style={styles.congratsCard}>
            <Text style={styles.congratsEmoji}>🏆</Text>
            <Text style={styles.congratsTitle}>YOU WON!</Text>
            <Text style={styles.congratsText}>
              {congratsNotifMessage || "Congratulations! You have been drawn as a winner in a sweepstakes!"}
            </Text>
            <Button title="Awesome!" onPress={dismissCongrats} />
          </Card>
        </View>
      )}
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
  list: { padding: 16, gap: 12, paddingBottom: 48 },
  header: { marginBottom: 4 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginTop: 4 },
  error: { color: colors.danger, marginTop: 8, fontWeight: "600" },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 40 },
  card: { flexDirection: "row", alignItems: "center", gap: 14 },
  pool: { color: colors.text, fontSize: 16, fontWeight: "800" },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  ticketId: { color: colors.border, fontSize: 11, marginTop: 4 },
  inboxSection: { marginTop: 20, gap: 8 },
  inboxHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clearNotifsLink: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 4 },
  inboxList: { gap: 8 },
  notifCard: { flexDirection: "row", padding: 12, gap: 10, alignItems: "center" },
  winCard: { borderColor: "#FFD700", borderLeftWidth: 4 },
  shipCard: { borderColor: "#34C759", borderLeftWidth: 4 },
  notifTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  winText: { color: "#FFD700" },
  shipText: { color: "#34C759" },
  notifMessage: { color: colors.text, fontSize: 13, marginTop: 2 },
  notifDate: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  unreadBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  particle: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 2,
    opacity: 0.85,
  },
  congratsModal: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    padding: 24,
  },
  congratsCard: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    gap: 16,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderColor: "#FFD700",
    borderWidth: 2,
  },
  congratsEmoji: { fontSize: 54 },
  congratsTitle: { color: "#FFD700", fontSize: 26, fontWeight: "900", letterSpacing: 1 },
  congratsText: { color: colors.text, textAlign: "center", fontSize: 14, lineHeight: 20, marginBottom: 8 },
});
