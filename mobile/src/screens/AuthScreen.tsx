import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ApiError, api } from "../api";
import { useAuth } from "../AuthContext";
import { Button, ChipBadge } from "../components";
import type { RootStackNavProp } from "../navigation";
import { CHIP_ORDER, colors } from "../theme";

type Mode = "login" | "register" | "forgot" | "reset";

export default function AuthScreen() {
  const navigation = useNavigation<RootStackNavProp>();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // DOB inputs
  const [dobYear, setDobYear] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");

  // Consent inputs
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentRules, setConsentRules] = useState(false);

  // Forgot / Reset password fields
  const [resetToken, setResetToken] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setInfo(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (mode !== "forgot" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (mode === "register") {
      const yearNum = parseInt(dobYear, 10);
      const monthNum = parseInt(dobMonth, 10);
      const dayNum = parseInt(dobDay, 10);

      if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
        setError("Please enter a valid date of birth (MM/DD/YYYY).");
        return;
      }
      if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
        setError("Please enter a valid month (1-12) and day (1-31).");
        return;
      }

      // Check age is 18+
      const dob = new Date(yearNum, monthNum - 1, dayNum);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      if (age < 18) {
        setError("You must be at least 18 years old to sign up.");
        return;
      }

      if (!consentTerms) {
        setError("You must agree to the Terms of Service and Privacy Policy.");
        return;
      }

      if (!consentRules) {
        setError("You must agree to the Official Sweepstakes Rules.");
        return;
      }

      const formattedDOB = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

      setBusy(true);
      try {
        await register(email.trim(), password, formattedDOB, true);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    } else if (mode === "login") {
      setBusy(true);
      try {
        await login(email.trim(), password);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    } else if (mode === "forgot") {
      setBusy(true);
      try {
        const res = await api.forgotPassword(email.trim());
        setInfo(res.message + " Please enter the 6-digit reset code below.");
        setMode("reset");
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    } else if (mode === "reset") {
      if (!resetToken.trim()) {
        setError("Please enter the 6-digit reset code.");
        return;
      }
      setBusy(true);
      try {
        const res = await api.resetPassword(resetToken.trim(), password);
        setInfo(res.message + " You can now log in.");
        setMode("login");
        setPassword("");
        setResetToken("");
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
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

        {(mode === "register" || mode === "login") ? (
          <View style={styles.toggle}>
            <Toggle label="Create account" active={mode === "register"} onPress={() => { setError(null); setInfo(null); setMode("register"); }} />
            <Toggle label="Log in" active={mode === "login"} onPress={() => { setError(null); setInfo(null); setMode("login"); }} />
          </View>
        ) : (
          <View style={styles.backToLogin}>
            <Pressable onPress={() => { setError(null); setInfo(null); setMode("login"); }}>
              <Text style={styles.backText}>← Back to Log In</Text>
            </Pressable>
          </View>
        )}

        {mode === "reset" && (
          <>
            <Text style={styles.label}>Reset Code</Text>
            <TextInput
              style={styles.input}
              value={resetToken}
              onChangeText={setResetToken}
              placeholder="6-digit code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
            />
          </>
        )}

        {mode !== "reset" && (
          <>
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
          </>
        )}

        {mode !== "forgot" && (
          <>
            <Text style={styles.label}>
              {mode === "reset" ? "New Password" : "Password"}
            </Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={submit}
            />
          </>
        )}

        {mode === "login" && (
          <Pressable style={styles.forgotTrigger} onPress={() => { setError(null); setInfo(null); setMode("forgot"); }}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        )}

        {mode === "register" && (
          <>
            <Text style={styles.label}>Date of Birth</Text>
            <View style={styles.dobRow}>
              <TextInput
                style={[styles.input, { flex: 1.2 }]}
                value={dobMonth}
                onChangeText={setDobMonth}
                placeholder="MM"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, { flex: 1.2 }]}
                value={dobDay}
                onChangeText={setDobDay}
                placeholder="DD"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, { flex: 1.6 }]}
                value={dobYear}
                onChangeText={setDobYear}
                placeholder="YYYY"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <Text style={styles.dobHelp}>You must be 18+ to enter sweepstakes.</Text>

            <View style={styles.consentRow}>
              <Checkbox checked={consentTerms} onPress={() => setConsentTerms(!consentTerms)} />
              <Text style={styles.consentText}>
                I agree to the{" "}
                <Text style={styles.link} onPress={() => navigation.navigate("TermsOfService")}>
                  Terms of Service
                </Text>{" "}
                and{" "}
                <Text style={styles.link} onPress={() => navigation.navigate("PrivacyPolicy")}>
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>

            <View style={styles.consentRow}>
              <Checkbox checked={consentRules} onPress={() => setConsentRules(!consentRules)} />
              <Text style={styles.consentText}>
                I have read and agree to the{" "}
                <Text style={styles.link} onPress={() => navigation.navigate("OfficialRules")}>
                  Official Sweepstakes Rules
                </Text>
                .
              </Text>
            </View>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <View style={{ height: 16 }} />
        <Button
          title={
            mode === "register"
              ? "Create account"
              : mode === "login"
              ? "Log in"
              : mode === "forgot"
              ? "Send Code"
              : "Reset Password"
          }
          onPress={submit}
          loading={busy}
        />

        {mode === "register" ? (
          <Text style={styles.note}>New accounts get a free starter stack to try the floor.</Text>
        ) : null}
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

function Checkbox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.checkbox, checked && styles.checkboxChecked]}
    >
      {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, paddingTop: 64, paddingBottom: 64, gap: 4 },
  hero: { alignItems: "center", marginBottom: 28 },
  brand: { color: colors.accent, fontSize: 40, fontWeight: "900", letterSpacing: 2 },
  tagline: { color: colors.textMuted, marginTop: 6, fontSize: 14 },
  chipRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  toggle: { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggleItem: { flex: 1, textAlign: "center", paddingVertical: 10, borderRadius: 10, fontWeight: "700", overflow: "hidden" },
  toggleActive: { backgroundColor: colors.accent, color: colors.accentText },
  toggleInactive: { backgroundColor: colors.surface, color: colors.textMuted },
  backToLogin: { marginBottom: 16 },
  backText: { color: colors.accent, fontWeight: "700", fontSize: 14 },
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
  forgotTrigger: {
    alignSelf: "flex-end",
    marginTop: 8,
    marginBottom: 8,
  },
  forgotText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 13,
  },
  dobRow: {
    flexDirection: "row",
    gap: 8,
  },
  dobHelp: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxTick: {
    color: colors.accentText,
    fontSize: 12,
    fontWeight: "900",
  },
  consentRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginTop: 10,
  },
  consentText: {
    color: colors.text,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  link: {
    color: colors.accent,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  error: { color: colors.danger, marginTop: 12, fontWeight: "600" },
  info: { color: colors.success, marginTop: 12, fontWeight: "600" },
  note: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 16 },
});
