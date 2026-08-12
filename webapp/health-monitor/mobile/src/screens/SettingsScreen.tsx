import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../api/endpoints";
import { getApiUrl, getDefaultApiUrl, setApiUrl } from "../api/client";
import Screen, { Card } from "../components/Screen";
import { colors } from "../theme/colors";

export default function SettingsScreen() {
  const [url, setUrl] = useState("");
  const [defaultUrl, setDefaultUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  useEffect(() => {
    getApiUrl().then(setUrl);
    getDefaultApiUrl().then(setDefaultUrl);
  }, []);

  async function onSave() {
    await setApiUrl(url);
    setStatus("idle");
    Alert.alert("Zapisano", "Adres API został zaktualizowany.");
  }

  async function onTest() {
    setTesting(true);
    setStatus("idle");
    try {
      await setApiUrl(url);
      await api.health();
      setStatus("ok");
    } catch {
      setStatus("error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Screen title="Ustawienia">
      <Card title="Adres backendu (FastAPI)">
        <TextInput
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.10/api"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.hint}>Domyślny: {defaultUrl}</Text>

        <View style={styles.row}>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={onTest} disabled={testing}>
            {testing ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.btnGhostText}>Testuj</Text>}
          </Pressable>
          <Pressable style={styles.btn} onPress={onSave}>
            <Text style={styles.btnText}>Zapisz</Text>
          </Pressable>
        </View>

        {status === "ok" && <Text style={styles.ok}>✅ Połączono z backendem.</Text>}
        {status === "error" && <Text style={styles.error}>❌ Brak połączenia — sprawdź adres i sieć.</Text>}
      </Card>

      <Text style={styles.hint}>
        Backend jest wystawiony przez nginx pod ścieżką /api (port 80).{"\n"}
        Fizyczny telefon: lokalne IP komputera w Wi-Fi (np. http://192.168.1.10/api).{"\n"}
        Emulator Androida: http://10.0.2.2/api.{"\n"}
        Build produkcyjny: publiczny adres backendu (https://.../api).
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    color: colors.text, padding: 10, marginBottom: 6,
  },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  btn: { flex: 1, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.accent },
  btnGhostText: { color: colors.accent, fontWeight: "700" },
  ok: { color: colors.accent2, marginTop: 10, fontSize: 12 },
  error: { color: colors.danger, marginTop: 10, fontSize: 12 },
});
