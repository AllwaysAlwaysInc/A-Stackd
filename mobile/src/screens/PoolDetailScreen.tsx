import React, { useState } from "react";
import {
  Alert,
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

export default function PoolDetailScreen({ route, navigation }: RootStackScreenProps<"PoolDetail">) {
  const { poolId } = route.params;
  const pool = useAsync<Pool>(() => api.pool(poolId), [poolId]);
  const wallet = useAsync<Wallet>(() => api.wallet(), [poolId]);

  const { savedAddress, saveAddress } = useAuth();
  const [chip, setChip] = useState<ChipColor | null>(null);
  const [form, setForm] = useState<AddressForm>(savedAddress ?? EMPTY_ADDRESS_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);

  const errors = validateAddress(form);
  const addressOk = isAddressValid(form);

  function setField(key: keyof AddressForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (pool.loading || wallet.loading) {
    return <Centered text="Loading pool…" />;
  }
  if (pool.error || !pool.data) {
    return <Centered text={pool.error ?? "Pool not found."} />;
  }

  const p = pool.data;
  const stacks = wallet.data?.stacks;
  // A pool accepts its required chip or a black "carpet bomb".
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
      notify("Ticket secured", res.msg);
      navigation.goBack();
    } catch (e) {
      notify("Could not buy ticket", e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
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
          <Stat label="Closes in" value={p.timeLeft} />
          <Stat label="Odds" value={`${p.meltingMultiplier}x`} highlight />
        </View>
        {p.salesAgentAlert ? <Banner text={p.salesAgentAlert} /> : null}
      </Card>

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
        </>
      )}
    </ScrollView>
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
});
