import { useNavigation } from "@react-navigation/native";
import React, { useState, useEffect } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View, TextInput } from "react-native";
import { api, type Pool } from "../api";
import { useAuth } from "../AuthContext";
import { Banner, Card, Pill, Button } from "../components";
import { useAsync } from "../hooks";
import type { RootStackNavProp } from "../navigation";
import { CHIP_META, colors } from "../theme";

function SkeletonPoolCard() {
  return (
    <Card style={StyleSheet.flatten([styles.card, { opacity: 0.25 }])}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ width: 180, height: 20, backgroundColor: colors.surfaceAlt, borderRadius: 4 }} />
          <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
            <View style={{ width: 80, height: 16, backgroundColor: colors.surfaceAlt, borderRadius: 4 }} />
            <View style={{ width: 85, height: 16, backgroundColor: colors.surfaceAlt, borderRadius: 4 }} />
          </View>
        </View>
        <View style={{ width: 56, height: 48, backgroundColor: colors.surfaceAlt, borderRadius: 12 }} />
      </View>
      <View style={{ width: 220, height: 14, backgroundColor: colors.surfaceAlt, borderRadius: 4, marginTop: 8 }} />
    </Card>
  );
}

export default function PoolsScreen() {
  const navigation = useNavigation<RootStackNavProp>();
  const { session, verifyEmailCode } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.activePools());

  // Email verification state
  const [email, setEmail] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Onboarding guide state
  const [showTutorial, setShowTutorial] = useState(true);

  useEffect(() => {
    if (session && !session.emailVerified) {
      api.profile()
        .then((p) => setEmail(p.email))
        .catch(() => {});
    }
  }, [session, session?.emailVerified]);

  async function handleVerifyEmail() {
    if (!email || !verificationCode.trim()) return;
    setVerifying(true);
    setVerificationError(null);
    try {
      await verifyEmailCode(email, verificationCode.trim());
      setVerificationCode("");
      reload();
    } catch (e) {
      setVerificationError(e instanceof Error ? e.message : "Invalid verification code.");
    } finally {
      setVerifying(false);
    }
  }

  const showVerificationBanner = session && !session.emailVerified;

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

            {/* Email Verification Banner */}
            {showVerificationBanner && (
              <Card style={styles.verifyCard}>
                <Text style={styles.verifyTitle}>⚠️ Email Verification Required</Text>
                <Text style={styles.verifyText}>
                  Please verify your email address ({email}) to unlock ticket purchases. Check your server logs for the 6-digit code.
                </Text>
                <View style={styles.verifyRow}>
                  <TextInput
                    style={styles.verifyInput}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Pressable
                    style={[styles.verifyButton, verifying && { opacity: 0.5 }]}
                    disabled={verifying}
                    onPress={handleVerifyEmail}
                  >
                    <Text style={styles.verifyButtonText}>{verifying ? "Verifying…" : "Submit"}</Text>
                  </Pressable>
                </View>
                {verificationError ? <Text style={styles.verifyError}>{verificationError}</Text> : null}
              </Card>
            )}

            {/* Onboarding Guide explaining Melting Odds */}
            {showTutorial && (
              <Card style={styles.tutorialCard}>
                <View style={styles.tutorialHeader}>
                  <Text style={styles.tutorialTitle}>🔥 Understanding Melting Odds</Text>
                  <Pressable onPress={() => setShowTutorial(false)}>
                    <Text style={styles.closeTutorial}>✕</Text>
                  </Pressable>
                </View>
                <Text style={styles.tutorialText}>
                  Unlike standard drawings where odds drop as more people enter, A Stack'd features <Text style={{ fontWeight: "700", color: colors.text }}>Melting Odds</Text>. 
                  The fewer entries in a pool, the higher the drawing power of each seat! 
                  A pool at 100/500 capacity gives you <Text style={{ fontWeight: "700", color: colors.accent }}>5x drawing power</Text>. 
                  Entering early maximizes your odds bonus. As more tickets fill, the bonus melts down to 1x.
                </Text>
              </Card>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 14 }}>
              <SkeletonPoolCard />
              <SkeletonPoolCard />
              <SkeletonPoolCard />
            </View>
          ) : (
            <Text style={styles.empty}>No active pools right now. Pull to refresh.</Text>
          )
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
            <Text style={styles.multiplierValue}>{pool.meltingMultiplier.toFixed(1)}x</Text>
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
  list: { padding: 16, gap: 14, paddingBottom: 48 },
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
  verifyCard: { borderColor: colors.danger, borderWidth: 1.5, gap: 10, marginBottom: 12 },
  verifyTitle: { color: colors.danger, fontSize: 15, fontWeight: "800" },
  verifyText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  verifyRow: { flexDirection: "row", gap: 10 },
  verifyInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    color: colors.text,
    fontSize: 14,
  },
  verifyButton: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
  verifyError: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  tutorialCard: { gap: 8, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: colors.accent },
  tutorialHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tutorialTitle: { color: colors.accent, fontSize: 15, fontWeight: "800" },
  closeTutorial: { color: colors.textMuted, fontSize: 16, paddingHorizontal: 6 },
  tutorialText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
