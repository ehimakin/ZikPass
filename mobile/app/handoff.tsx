import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { claimHandoff } from "../src/native-wallet";

export default function HandoffScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    if (!token) {
      setError("This ZikPass handoff is missing its token.");
      return;
    }

    void claimHandoff(token)
      .then(() => router.replace("/wallet"))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Unable to secure the ZikPass on this device.");
      });
  }, [params.token, router]);

  return (
    <View style={styles.screen}>
      {error ? (
        <>
          <Text style={styles.title}>Handoff could not complete</Text>
          <Text style={styles.body}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color="#0e1726" size="large" />
          <Text style={styles.title}>Securing your ZikPass</Text>
          <Text style={styles.body}>Creating a device-bound native wallet.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: "#f4f7ee",
    flex: 1,
    justifyContent: "center",
    padding: 32
  },
  title: {
    color: "#0e1726",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 24,
    textAlign: "center"
  },
  body: {
    color: "#536070",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    textAlign: "center"
  }
});
