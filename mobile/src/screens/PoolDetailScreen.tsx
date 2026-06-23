import React, { useState, useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  EMPTY_ADDRESS_FORM,
  isAddressValid,
  toShippingAddress,
  validateAddress,
  type AddressForm,
} from "../address";
import { ApiError, api, type ChipColor, type Pool, type Wallet } from "../api";
import { useAuth } from "../AuthContext";
import { Banner, Button, Card, ChipBadge, Pill } from "../components";
import { useAsync } from "../hooks";
import type { RootStackScreenProps } from "../navigation";
import { CHIP_META, colors } from "../theme";

function formatCountdown(sec: number): string {
  if (sec <= 0) return "closed";
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function getGaugeColor(multiplier: number): string {
  if (multiplier > 3.0) return "#FF4538"; // Hot Red
  if (multiplier > 1.5) return "#FF9F0A"; // Warm Gold/Orange
  return "#0A84FF"; // Cool Blue
}

export default function PoolDetailScreen({ route, navigation }: RootStackScreenProps<"PoolDetail">) {
  const { poolId } = route.params;
  const pool = useAsync<Pool>(() => api.pool(poolId), [poolId]);
  const wallet = useAsync<Wallet>(() => api.wallet(), [poolId]);

  const { savedAddress, saveAddress } = useAuth();
  const [chip, setChip] = useState<ChipColor | null>(null);
  const [form, setForm] = useState<AddressForm>(savedAddress ?? EMPTY_ADDRESS_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);

  // Countdown timer state
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Chip drop animation states
  const [droppingChip, setDroppingChip] = useState<ChipColor | null>(null);
  const dropAnim = useRef(new Animated.Value(-200)).current;
  const scaleAnim = useRef(new Animated.Value(1.5)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Melting Odds gauge animation
  const fillAnim = useRef(new Animated.Value(0)).current;

  const errors = validateAddress(form);
  const addressOk = isAddressValid(form);

  function setField(key: keyof AddressForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Live countdown hook
  useEffect(() => {
    const data = pool.data;
    if (!data || data.drawnAt !== undefined) return;
    const closesAt = data.closesAt;
    
    function update() {
      const diff = closesAt - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(diff / 1000)));
    }
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [pool.data]);

  // Melting Odds progress gauge animation hook
  const fillPercentage = pool.data ? Math.min(100, Math.max(0, (pool.data.filled / pool.data.capacity) * 100)) : 0;
  useEffect(() => {
    if (pool.data) {
      Animated.timing(fillAnim, {
        toValue: fillPercentage,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [fillPercentage, pool.data]);

  if (pool.loading || wallet.loading) {
    return <Centered text="Loading pool…" />;
  }
  if (pool.error || !pool.data) {
    return <Centered text={pool.error ?? "Pool not found."} />;
  }

  const p = pool.data;
  const stacks = wallet.data?.stacks;
  const options: ChipColor[] = p.requiredChip === "black" ? ["black"] : [p.requiredChip, "black"];
  const drawn = p.drawnAt !== undefined;

  function notify(title: string, message: string) {
    if (Platform.OS === "web") window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  }

  async function confirm() {
    if (!chip) return;
    if (!addressOk) {
      setShowErrors(true);
      notify("Valid address required", "Prizes ship to a real address. Complete every field to drop a chip.");
      return;
    }
    setBusy(true);
    try {
      await saveAddress(form);
      const res = await api.buyTicket(poolId, chip, toShippingAddress(form));
      
      // Perform chip drop micro-interaction animation
      setDroppingChip(chip);
      dropAnim.setValue(-200);
      scaleAnim.setValue(1.5);
      opacityAnim.setValue(1);

      Animated.sequence([
        Animated.timing(dropAnim, {
          toValue: 200,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setDroppingChip(null);
        notify("Ticket secured", res.msg);
        navigation.goBack();
      });
    } catch (e) {
      notify("Could not buy ticket", e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmFreeEntry() {
    if (!addressOk) {
      setShowErrors(true);
      notify("Valid address required", "Prizes ship to a real address. Complete every field to request AMOE.");
      return;
    }
    setBusy(true);
    try {
      await saveAddress(form);
      const res = await api.freeEntry(poolId, toShippingAddress(form));
      
      // Free entries are represented by white chips in the AMOE theme, drop one!
      setDroppingChip("white");
      dropAnim.setValue(-200);
      scaleAnim.setValue(1.5);
      opacityAnim.setValue(1);

      Animated.sequence([
        Animated.timing(dropAnim, {
          toValue: 200,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setDroppingChip(null);
        notify("Free Entry Secured", res.msg);
        navigation.goBack();
      });
    } catch (e) {
      notify("Could not claim free entry", e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const gaugeColor = getGaugeColor(p.meltingMultiplier);

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        <Card style={{ gap: 12 }}>
          <View style={styles.row}>
            <Pill text={p.type.replace("_", " ")} />
            {p.isGuaranteed ? <Pill text="Guaranteed" tone="success" /> : null}
            {drawn ? <Pill text="Drawn" tone="accent" /> : null}
          </View>
          <Text style={styles.prize}>{p.prize}</Text>
          <View style={styles.statsRow}>
            <Stat label="Status" value={p.status} />
            <Stat label="Closes in" value={drawn ? "Closed" : formatCountdown(secondsLeft)} />
            <Stat label="Odds" value={`${p.meltingMultiplier.toFixed(1)}x`} highlight />
          </View>
          {p.salesAgentAlert ? <Banner text={p.salesAgentAlert} /> : null}
        </Card>

        {/* Melting Odds Power Gauge */}
        {!drawn && (
          <Card style={styles.gaugeCard}>
            <View style={styles.gaugeHeader}>
              <Text style={styles.gaugeTitle}>🔥 Melting Odds Power</Text>
              <Text style={[styles.gaugeValue, { color: gaugeColor }]}>{p.meltingMultiplier.toFixed(1)}x</Text>
            </View>
            <View style={styles.gaugeTrack}>
              <Animated.View
                style={[
                  styles.gaugeFill,
                  {
                    width: fillAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ["0%", "100%"],
                    }),
                    backgroundColor: gaugeColor,
                  },
                ]}
              />
            </View>
            <View style={styles.gaugeFooter}>
              <Text style={styles.gaugeFooterText}>{p.filled} / {p.capacity} filled</Text>
              <Text style={styles.gaugeFooterText}>
                {Math.round(100 - fillPercentage)}% odds bonus remaining
              </Text>
            </View>
          </Card>
        )}

        {drawn ? (
          <Card>
            <Text style={styles.sectionTitle}>This pool has been drawn</Text>
            <Text style={styles.muted}>Winner: {p.winnerUserId}</Text>
            <Text style={styles.muted}>Winning ticket: {p.winningTicketId}</Text>
          </Card>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Choose your chip</Text>
            <View style={styles.chipOptions}>
              {options.map((c) => {
                const meta = CHIP_META[c];
                const owned = stacks ? stacks[c] : 0;
                const selected = chip === c;
                const disabled = owned <= 0;
                return (
                  <Pressable
                    key={c}
                    disabled={disabled}
                    onPress={() => setChip(c)}
                    style={[
                      styles.chipOption,
                      selected && styles.chipOptionSelected,
                      disabled && styles.chipOptionDisabled,
                    ]}
                  >
                    <ChipBadge color={c} size={46} />
                    <Text style={styles.chipOptionLabel}>{meta.label}</Text>
                    <Text style={styles.chipOptionSeats}>
                      {meta.seats} seat{meta.seats > 1 ? "s" : ""}
                    </Text>
                    <Text style={[styles.chipOptionOwned, disabled && { color: colors.danger }]}>
                      You own {owned}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Shipping address</Text>
            <Text style={styles.muted}>Where we ship the prize if you win. Required before dropping a chip.</Text>

            <Field
              label="Recipient name"
              value={form.name}
              onChangeText={(t) => setField("name", t)}
              placeholder="Full name"
              error={showErrors ? errors.name : undefined}
            />
            <Field
              label="Street address"
              value={form.line1}
              onChangeText={(t) => setField("line1", t)}
              placeholder="123 Main St"
              error={showErrors ? errors.line1 : undefined}
            />
            <Field
              label="Apt / Suite (optional)"
              value={form.line2}
              onChangeText={(t) => setField("line2", t)}
              placeholder="Apt 4B"
            />
            <Field
              label="City"
              value={form.city}
              onChangeText={(t) => setField("city", t)}
              placeholder="Las Vegas"
              error={showErrors ? errors.city : undefined}
            />
            <View style={styles.row2}>
              <View style={styles.stateField}>
                <Field
                  label="State"
                  value={form.state}
                  onChangeText={(t) => setField("state", t.toUpperCase())}
                  placeholder="NV"
                  autoCapitalize="characters"
                  maxLength={2}
                  error={showErrors ? errors.state : undefined}
                />
              </View>
              <View style={styles.zipField}>
                <Field
                  label="ZIP code"
                  value={form.postalCode}
                  onChangeText={(t) => setField("postalCode", t)}
                  placeholder="89101"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  error={showErrors ? errors.postalCode : undefined}
                />
              </View>
            </View>

            <View style={{ height: 8 }} />
            <Button
              title={!chip ? "Select a chip" : !addressOk ? "Enter a valid address" : `Drop ${CHIP_META[chip].label} chip`}
              onPress={confirm}
              loading={busy}
              disabled={!chip || !addressOk}
            />
            <Text style={styles.disclaimer}>
              One chip is debited per drop. Black is limited to one per pool (the whale limit).
            </Text>

            {/* AMOE Free Entry section */}
            <Card style={styles.amoeCard}>
              <Text style={styles.amoeTitle}>🎁 Alternate Method of Entry (AMOE)</Text>
              <Text style={styles.amoeText}>
                No purchase necessary. You can secure 1 free entry seat in this sweepstakes. It carries the exact same odds of winning as paid chip entries. Limit 1 free entry per pool.
              </Text>
              <Button
                title="Claim 1 Free Seat"
                variant="ghost"
                disabled={!addressOk || busy}
                onPress={confirmFreeEntry}
              />
            </Card>
          </>
        )}
      </ScrollView>

      {/* Chip drop animation overlay */}
      {droppingChip && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.animationOverlay}>
            <Animated.View
              style={[
                styles.droppingChipContainer,
                {
                  transform: [
                    { translateY: dropAnim },
                    { scale: scaleAnim },
                  ],
                  opacity: opacityAnim,
                },
              ]}
            >
              <ChipBadge color={droppingChip} size={96} />
              <Text style={styles.droppingText}>PLACING TICKET...</Text>
            </Animated.View>
            <View style={styles.floorSlot}>
              <View style={styles.floorSlotInner} />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  autoCapitalize,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  error?: string;
  autoCapitalize?: "none" | "characters" | "words" | "sentences";
  keyboardType?: "default" | "numbers-and-punctuation";
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize ?? "words"}
        keyboardType={keyboardType ?? "default"}
        maxLength={maxLength}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: colors.accent }]}>{value}</Text>
    </View>
  );
}

function Centered({ text }: { text: string }) {
  return (
    <View style={[styles.flex, styles.centered]}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 14 },
  centered: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  prize: { color: colors.text, fontSize: 24, fontWeight: "900" },
  statsRow: { flexDirection: "row", gap: 12 },
  stat: { flex: 1 },
  statLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", fontWeight: "700" },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 6 },
  muted: { color: colors.textMuted, marginTop: 4 },
  chipOptions: { flexDirection: "row", gap: 10 },
  chipOption: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  chipOptionSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  chipOptionDisabled: { opacity: 0.45 },
  chipOptionLabel: { color: colors.text, fontWeight: "800", marginTop: 6 },
  chipOptionSeats: { color: colors.textMuted, fontSize: 12 },
  chipOptionOwned: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  field: { gap: 4 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  fieldError: { color: colors.danger, fontSize: 12 },
  row2: { flexDirection: "row", gap: 10 },
  stateField: { width: 96 },
  zipField: { flex: 1 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    fontSize: 15,
  },
  inputError: { borderColor: colors.danger },
  disclaimer: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 10 },
  gaugeCard: { gap: 10 },
  gaugeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gaugeTitle: { color: colors.text, fontWeight: "700", fontSize: 14 },
  gaugeValue: { fontWeight: "900", fontSize: 18 },
  gaugeTrack: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceAlt, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  gaugeFill: { height: "100%", borderRadius: 6 },
  gaugeFooter: { flexDirection: "row", justifyContent: "space-between" },
  gaugeFooterText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  amoeCard: { marginTop: 12, borderStyle: "dashed", borderColor: colors.border, gap: 10 },
  amoeTitle: { color: colors.accent, fontSize: 15, fontWeight: "800" },
  amoeText: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  animationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 120,
    paddingBottom: 160,
  },
  droppingChipContainer: {
    alignItems: "center",
    gap: 16,
  },
  droppingText: {
    color: colors.accent,
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 3,
  },
  floorSlot: {
    width: 160,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1C1C1E",
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  floorSlotInner: {
    width: 130,
    height: 12,
    backgroundColor: "#000",
    borderRadius: 6,
  },
});
