import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../api/endpoints";
import Screen, { Card, EmptyState } from "../components/Screen";
import { colors } from "../theme/colors";

function SliderRow({
  label,
  value,
  onChange,
  min = 1,
  max = 9,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}: {value}</Text>
      <View style={styles.pillRow}>
        {options.map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={[styles.pill, n === value && styles.pillActive]}
          >
            <Text style={[styles.pillText, n === value && styles.pillTextActive]}>{n}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function SurveyScreen() {
  const queryClient = useQueryClient();
  const [valence, setValence] = useState(5);
  const [arousal, setArousal] = useState(5);
  const [dominance, setDominance] = useState(5);
  const [vasStress, setVasStress] = useState(50);
  const [notes, setNotes] = useState("");

  const surveysQuery = useQuery({
    queryKey: ["surveys"],
    queryFn: () => api.getSurveys(20),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.postSurvey({
        sam_valence: valence,
        sam_arousal: arousal,
        sam_dominance: dominance,
        vas_stress: vasStress,
        notes: notes || null,
      }),
    onSuccess: () => {
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      Alert.alert("Zapisano", "Ankieta została zapisana.");
    },
    onError: (e) => Alert.alert("Błąd", (e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteSurvey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["surveys"] }),
  });

  const onRefresh = useCallback(() => surveysQuery.refetch(), [surveysQuery]);

  return (
    <Screen title="Ankieta" onRefresh={onRefresh} refreshing={surveysQuery.isRefetching}>
      <Card title="Nowy pomiar SAM / VAS">
        <SliderRow label="Nastrój (valence)" value={valence} onChange={setValence} />
        <SliderRow label="Pobudzenie (arousal)" value={arousal} onChange={setArousal} />
        <SliderRow label="Dominacja" value={dominance} onChange={setDominance} />

        <Text style={styles.sliderLabel}>Stres (VAS 0-100): {vasStress}</Text>
        <View style={styles.vasRow}>
          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => (
            <Pressable
              key={n}
              onPress={() => setVasStress(n)}
              style={[styles.vasPill, n === vasStress && styles.pillActive]}
            >
              <Text style={[styles.pillText, n === vasStress && styles.pillTextActive]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          placeholder="Notatki (opcjonalnie)"
          placeholderTextColor={colors.muted}
          value={notes}
          onChangeText={setNotes}
          style={styles.input}
          multiline
        />

        <Pressable
          style={styles.submitBtn}
          onPress={() => submitMutation.mutate()}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Zapisz</Text>
          )}
        </Pressable>
      </Card>

      <Text style={styles.sectionTitle}>Historia</Text>
      {surveysQuery.isLoading && <ActivityIndicator color={colors.accent} />}
      {surveysQuery.data?.length === 0 && <EmptyState text="Brak zapisanych ankiet." />}
      {surveysQuery.data?.map((s) => (
        <Card key={s.id}>
          <View style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyDate}>{s.date}</Text>
              <Text style={styles.historyDetail}>
                VAS {s.vas_stress ?? "—"} · SAM {s.sam_valence ?? "—"}/{s.sam_arousal ?? "—"}/{s.sam_dominance ?? "—"}
              </Text>
              {s.notes ? <Text style={styles.historyNotes}>{s.notes}</Text> : null}
            </View>
            <Pressable onPress={() => deleteMutation.mutate(s.id)}>
              <Text style={styles.deleteText}>Usuń</Text>
            </Pressable>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sliderRow: { marginBottom: 10 },
  sliderLabel: { color: colors.text, fontSize: 13, marginBottom: 6 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  vasRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  pill: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
  },
  vasPill: {
    minWidth: 36, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 6,
  },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  pillTextActive: { color: "#fff" },
  input: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    color: colors.text, padding: 10, minHeight: 60, textAlignVertical: "top", marginBottom: 12,
  },
  submitBtn: { backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "700" },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 4 },
  historyRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  historyDate: { color: colors.text, fontWeight: "600", fontSize: 13 },
  historyDetail: { color: colors.muted, fontSize: 12, marginTop: 2 },
  historyNotes: { color: colors.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: "600" },
});
