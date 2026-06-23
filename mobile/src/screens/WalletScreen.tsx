import React, { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
  Pressable,
  TextInput,
} from "react-native";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { Button, Card, ChipBadge } from "../components";
import { useAsync } from "../hooks";
import { CHIP_META, CHIP_ORDER, colors } from "../theme";

const PACKS = [
  { id: "starter_bundle", name: "Starter Bundle", price: "$20.00", desc: "Best value! 5 Red, 2 White, 1 Blue chips" },
  { id: "red_pack_5", name: "Red Chip Pack (5x)", price: "$5.00", desc: "5 Red chips ($5 value each)" },
  { id: "white_pack_5", name: "White Chip Pack (5x)", price: "$25.00", desc: "5 White chips ($25 value each)" },
  { id: "blue_pack_5", name: "Blue Chip Pack (5x)", price: "$50.00", desc: "5 Blue chips ($50 value each)" },
  { id: "black_pack_1", name: "Black Whale Chip (1x)", price: "$100.00", desc: "1 Black Whale chip ($100 value)" },
];

const PACK_THEMES: Record<string, string> = {
  starter_bundle: colors.accent,
  red_pack_5: "#FF453A",
  white_pack_5: "#F2F2F7",
  blue_pack_5: "#0A84FF",
  black_pack_1: "#3A3A3C",
};

export default function WalletScreen() {
  const { session, logout } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.wallet());
  const addressBook = useAsync(() => api.listAddresses(), []);

  // Inline address creation state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLine1, setNewLine1] = useState("");
  const [newLine2, setNewLine2] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const stacks = data?.stacks;
  const totalValue = stacks
    ? CHIP_ORDER.reduce((sum, c) => sum + stacks[c] * CHIP_META[c].value, 0)
    : 0;

  function reloadAll() {
    reload();
    addressBook.reload();
  }

  async function buyPack(packId: string) {
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await api.createCheckoutSession(packId);
      await Linking.openURL(res.url);
    } catch (e) {
      setActionError("Failed to initiate checkout. Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  async function deleteAddress(addressId: string) {
    setActionBusy(true);
    setActionError(null);
    try {
      await api.deleteAddress(addressId);
      addressBook.reload();
    } catch (e) {
      setActionError("Failed to delete address.");
    } finally {
      setActionBusy(false);
    }
  }

  async function addAddress() {
    setActionError(null);
    if (!newName.trim() || !newLine1.trim() || !newCity.trim() || !newState.trim() || !newPostalCode.trim()) {
      setActionError("Please fill in all required address fields.");
      return;
    }
    setActionBusy(true);
    try {
      await api.createAddress({
        name: newName.trim(),
        line1: newLine1.trim(),
        line2: newLine2.trim() || undefined,
        city: newCity.trim(),
        state: newState.trim().toUpperCase(),
        postalCode: newPostalCode.trim(),
      }, addressBook.data?.addresses.length === 0);
      
      // Clear inputs
      setNewName("");
      setNewLine1("");
      setNewLine2("");
      setNewCity("");
      setNewState("");
      setNewPostalCode("");
      setShowAddForm(false);
      addressBook.reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add address.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading || addressBook.loading} onRefresh={reloadAll} tintColor={colors.accent} />}
    >
      <Text style={styles.title}>Your Stack</Text>
      <Text style={styles.subtitle}>{session?.userId}</Text>

      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Stack value</Text>
        <Text style={styles.totalValue}>${totalValue.toLocaleString()}</Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

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

      {/* Buy Chips Section */}
      <Text style={styles.sectionTitle}>Buy Chips</Text>
      <Text style={styles.muted}>Top up your wallet instantly using secure payments. Chip packages drop immediately.</Text>
      
      <View style={styles.packList}>
        {PACKS.map((p) => {
          const themeColor = PACK_THEMES[p.id];
          return (
            <Card key={p.id} style={styles.packCard}>
              <View style={[styles.packIndicator, { backgroundColor: themeColor }]} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.packHeader}>
                  <Text style={styles.packName}>{p.name}</Text>
                  <Text style={[styles.packPrice, { color: themeColor }]}>{p.price}</Text>
                </View>
                <Text style={styles.packDesc}>{p.desc}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.packButton,
                    { backgroundColor: themeColor + "20", borderColor: themeColor },
                    pressed && { opacity: 0.7 }
                  ]}
                  disabled={actionBusy}
                  onPress={() => buyPack(p.id)}
                >
                  <Text style={[styles.packButtonText, { color: themeColor }]}>
                    Purchase Pack
                  </Text>
                </Pressable>
              </View>
            </Card>
          );
        })}
      </View>

      {/* Address Book Section */}
      <Text style={styles.sectionTitle}>Address Book</Text>
      <Text style={styles.muted}>Manage shipping details for claiming sweepstakes prizes.</Text>

      {addressBook.data?.addresses.map((a) => (
        <Card key={a.address_id} style={styles.addressCard}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.packHeader}>
              <Text style={styles.addressName}>{a.name}</Text>
              {a.is_default && <PillText text="Default" color={colors.accent} />}
            </View>
            <Text style={styles.addressLine}>{a.line1}</Text>
            {a.line2 ? <Text style={styles.addressLine}>{a.line2}</Text> : null}
            <Text style={styles.addressLine}>{a.city}, {a.state} {a.postal_code}</Text>
          </View>
          <Pressable
            style={styles.deleteButton}
            disabled={actionBusy}
            onPress={() => deleteAddress(a.address_id)}
          >
            <Text style={styles.deleteButtonText}>✕</Text>
          </Pressable>
        </Card>
      ))}

      {addressBook.data?.addresses.length === 0 && (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No saved addresses found.</Text>
        </Card>
      )}

      {!showAddForm ? (
        <Button
          title="Add New Address"
          variant="ghost"
          onPress={() => setShowAddForm(true)}
        />
      ) : (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>New Shipping Address</Text>
          
          <Text style={styles.fieldLabel}>Recipient Name</Text>
          <TextInput
            style={styles.formInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="John Doe"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Street Address</Text>
          <TextInput
            style={styles.formInput}
            value={newLine1}
            onChangeText={setNewLine1}
            placeholder="123 Main St"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.fieldLabel}>Apt / Suite / Unit (Optional)</Text>
          <TextInput
            style={styles.formInput}
            value={newLine2}
            onChangeText={setNewLine2}
            placeholder="Apt 4B"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.fieldLabel}>City</Text>
          <TextInput
            style={styles.formInput}
            value={newCity}
            onChangeText={setNewCity}
            placeholder="Las Vegas"
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.row2}>
            <View style={styles.stateField}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput
                style={styles.formInput}
                value={newState}
                onChangeText={(t) => setNewState(t.toUpperCase())}
                placeholder="NV"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
            <View style={styles.zipField}>
              <Text style={styles.fieldLabel}>ZIP Code</Text>
              <TextInput
                style={styles.formInput}
                value={newPostalCode}
                onChangeText={setNewPostalCode}
                placeholder="89101"
                placeholderTextColor={colors.textMuted}
                maxLength={10}
              />
            </View>
          </View>

          <View style={styles.formButtons}>
            <Pressable
              style={[styles.formButton, styles.formButtonCancel]}
              onPress={() => setShowAddForm(false)}
            >
              <Text style={styles.formButtonCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.formButton, styles.formButtonSave]}
              disabled={actionBusy}
              onPress={addAddress}
            >
              <Text style={styles.formButtonSaveText}>Save Address</Text>
            </Pressable>
          </View>
        </Card>
      )}

      <View style={{ height: 16 }} />
      <Button title="Log out" variant="ghost" onPress={logout} />
    </ScrollView>
  );
}

function PillText({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.pillTextContainer, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 14, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.textMuted, marginBottom: 4 },
  totalCard: { alignItems: "center", paddingVertical: 24 },
  totalLabel: { color: colors.textMuted, textTransform: "uppercase", fontSize: 12, fontWeight: "700" },
  totalValue: { color: colors.accent, fontSize: 44, fontWeight: "900", marginTop: 4 },
  error: { color: colors.danger, fontWeight: "600", marginTop: 8 },
  grid: { gap: 10 },
  chipCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  chipName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  chipMood: { color: colors.textMuted, fontWeight: "600" },
  chipSeats: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  chipCount: { color: colors.text, fontSize: 24, fontWeight: "900" },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 16 },
  packList: { gap: 12 },
  packCard: { flexDirection: "row", padding: 14, overflow: "hidden", gap: 12 },
  packIndicator: { width: 6, borderRadius: 3 },
  packHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  packName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  packPrice: { fontSize: 16, fontWeight: "900" },
  packDesc: { color: colors.textMuted, fontSize: 12 },
  packButton: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  packButtonText: { fontSize: 13, fontWeight: "800" },
  addressCard: { flexDirection: "row", alignItems: "center", padding: 14 },
  addressName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  addressLine: { color: colors.textMuted, fontSize: 13 },
  pillTextContainer: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillText: { fontSize: 10, fontWeight: "800" },
  deleteButton: {
    padding: 10,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyCard: { padding: 20, alignItems: "center" },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  formCard: { gap: 8 },
  formTitle: { color: colors.accent, fontSize: 16, fontWeight: "800", marginBottom: 4 },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 4 },
  formInput: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    color: colors.text,
    fontSize: 14,
  },
  row2: { flexDirection: "row", gap: 10 },
  stateField: { width: 80 },
  zipField: { flex: 1 },
  formButtons: { flexDirection: "row", gap: 10, marginTop: 12 },
  formButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  formButtonCancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  formButtonCancelText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  formButtonSave: {
    backgroundColor: colors.accent,
  },
  formButtonSaveText: { color: colors.accentText, fontWeight: "800", fontSize: 14 },
});
