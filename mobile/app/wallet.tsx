import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { SignedCredential } from "../../lib/shared/types";
import { authenticateWallet, loadNativeCredential } from "../src/native-wallet";

export default function WalletScreen() {
  const [credential, setCredential] = useState<SignedCredential | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadNativeCredential()
        .then((storedCredential) => {
          if (active) {
            setCredential(storedCredential);
          }
        })
        .catch(() => {
          if (active) {
            setMessage("The protected native wallet could not be read.");
          }
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [])
  );

  async function unlock() {
    setMessage(null);
    try {
      await authenticateWallet();
      setMessage("Device authentication confirmed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Device authentication failed.");
    }
  }

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color="#0e1726" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>ZikPass wallet</Text>
      <Text style={styles.title}>{credential ? "Your pass is on this device" : "No pass yet"}</Text>
      <Text style={styles.body}>
        {credential
          ? "Your native wallet holds the signed over-18 credential."
          : "Complete onboarding in the web app, then choose Open in ZikPass."}
      </Text>
      {credential ? (
        <View style={styles.pass}>
          <Text style={styles.passEyebrow}>Over 18</Text>
          <Text style={styles.passTitle}>Physically verified</Text>
          <Text style={styles.passMeta}>{credential.payload.credential_id}</Text>
          <Pressable onPress={() => void unlock()} style={styles.button}>
            <Text style={styles.buttonText}>Authenticate to use pass</Text>
          </Pressable>
        </View>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f4f7ee",
    flex: 1,
    padding: 24,
    paddingTop: 88
  },
  eyebrow: {
    color: "#71804d",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  title: {
    color: "#0e1726",
    fontSize: 36,
    fontWeight: "700",
    marginTop: 16
  },
  body: {
    color: "#536070",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16
  },
  pass: {
    backgroundColor: "#ffffff",
    borderColor: "#dfe8c8",
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 36,
    padding: 24
  },
  passEyebrow: {
    color: "#71804d",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  passTitle: {
    color: "#0e1726",
    fontSize: 25,
    fontWeight: "700",
    marginTop: 10
  },
  passMeta: {
    color: "#536070",
    fontSize: 12,
    marginTop: 18
  },
  button: {
    alignItems: "center",
    backgroundColor: "#0e1726",
    borderRadius: 999,
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  buttonText: {
    color: "#f4f7ee",
    fontSize: 14,
    fontWeight: "700"
  },
  message: {
    color: "#536070",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 18
  }
});
