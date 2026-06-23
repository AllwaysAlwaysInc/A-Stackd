import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, API_BASE_URL } from "../api";
import { useAuth } from "../AuthContext";
import { Button, ChipBadge } from "../components";
import { CHIP_ORDER, colors } from "../theme";

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!email.trim() || password.length < 8) {
      setError("Enter an email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") await register(email.trim(), password);
      else await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.brand}>A STACK'D</Text>
          <Text style={styles.tagline}>Stack your chips. Melt the odds.</Text>
          <View style={styles.chipRow}>
            {CHIP_ORDER.map((c) => (
              <ChipBadge key={c} color={c} size={40} />
            ))}
          </View>
        </View>

        <View style={styles.toggle}>
          <Toggle label="Create account" active={mode === "register"} onPress={() => setMode("register")} />
          <Toggle label="Log in" active={mode === "login"} onPress={() => setMode("login")} />
        </View>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={submit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ height: 8 }} />
        <Button title={mode === "register" ? "Create account" : "Log in"} onPress={submit} loading={busy} />

        {mode === "register" ? (
          <Text style={styles.note}>New accounts get a free starter stack to try the floor.</Text>
        ) : null}
        <Text style={styles.server}>Server: {API_BASE_URL}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={[styles.toggleItem, active ? styles.toggleActive : styles.toggleInactive]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, paddingTop: 72, gap: 4 },
  hero: { alignItems: "center", marginBottom: 28 },
  brand: { color: colors.accent, fontSize: 40, fontWeight: "900", letterSpacing: 2 },
  tagline: { color: colors.textMuted, marginTop: 6, fontSize: 14 },
  chipRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  toggle: { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggleItem: { flex: 1, textAlign: "center", paddingVertical: 10, borderRadius: 10, fontWeight: "700", overflow: "hidden" },
  toggleActive: { backgroundColor: colors.accent, color: colors.accentText },
  toggleInactive: { backgroundColor: colors.surface, color: colors.textMuted },
  label: { color: colors.textMuted, fontSize: 13, marginTop: 12, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.danger, marginTop: 12, fontWeight: "600" },
  note: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 16 },
  server: { color: colors.border, fontSize: 11, textAlign: "center", marginTop: 24 },
});
