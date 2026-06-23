import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { Card } from "../components";

export function OfficialRulesScreen() {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title}>Official Rules</Text>
        <Text style={styles.warning}>
          ⚠️ DISCLAIMER: This is placeholder legal text. A lawyer must finalize this wording before launch.
        </Text>
        <Text style={styles.paragraph}>
          1. NO PURCHASE NECESSARY. A purchase or payment of any kind will not increase your chances of winning.
        </Text>
        <Text style={styles.paragraph}>
          2. Eligibility: A Stack'd is open only to legal residents of the United States who are at least eighteen (18) years old at the time of entry. Void where prohibited by law.
        </Text>
        <Text style={styles.paragraph}>
          3. Sponsor: The sweepstakes is sponsored by A Stack'd Corp.
        </Text>
        <Text style={styles.paragraph}>
          4. How to Enter: You can enter by spending chips loaded into your wallet, or via the Alternate Method of Entry (AMOE) "No Purchase Necessary" path.
        </Text>
        <Text style={styles.paragraph}>
          5. Drawing: Winners are drawn randomly using a cryptographically verifiable Commit-Reveal RNG scheme. Odds of winning depend on the number of eligible entries received.
        </Text>
      </Card>
    </ScrollView>
  );
}

export function TermsOfServiceScreen() {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.warning}>
          ⚠️ DISCLAIMER: This is placeholder legal text. A lawyer must finalize this wording before launch.
        </Text>
        <Text style={styles.paragraph}>
          By using A Stack'd, you agree to these Terms of Service. You represent that you are at least 18 years of age and reside in an eligible US state.
        </Text>
        <Text style={styles.paragraph}>
          We reserve the right to suspend accounts suspected of cheating, scripting, or bypassing the whale limits. All ticket transactions are immutable and cannot be undone.
        </Text>
      </Card>
    </ScrollView>
  );
}

export function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.warning}>
          ⚠️ DISCLAIMER: This is placeholder legal text. A lawyer must finalize this wording before launch.
        </Text>
        <Text style={styles.paragraph}>
          We value your privacy. We collect your email address, date of birth, and shipping address to verify eligibility and fulfill physical prizes.
        </Text>
        <Text style={styles.paragraph}>
          Your location is validated at checkout to comply with state sweepstakes regulations. We do not sell your personal data to third parties.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16 },
  card: { gap: 14 },
  title: { color: colors.accent, fontSize: 24, fontWeight: "900", marginBottom: 6 },
  warning: {
    color: colors.danger,
    backgroundColor: "rgba(255, 69, 58, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 69, 58, 0.3)",
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  paragraph: { color: colors.text, fontSize: 14, lineHeight: 22 },
});
