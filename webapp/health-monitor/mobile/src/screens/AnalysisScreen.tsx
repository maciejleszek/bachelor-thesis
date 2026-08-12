import { useCallback } from "react";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { api } from "../api/endpoints";
import Screen, { Card, EmptyState } from "../components/Screen";
import { colors } from "../theme/colors";

const METRIC_LABELS: Record<string, string> = {
  hrv: "HRV",
  resting_hr: "Tętno spoczynkowe",
  sleep_score: "Wynik snu",
  sleep_total_min: "Czas snu",
  spo2: "SpO₂",
  avg_stress: "Stres (Garmin)",
};

function corrColor(r: number | null): string {
  if (r == null) return colors.muted;
  const abs = Math.abs(r);
  if (abs >= 0.5) return colors.danger;
  if (abs >= 0.3) return colors.warn;
  return colors.accent2;
}

export default function AnalysisScreen() {
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["correlation"],
    queryFn: () => api.getCorrelation({}),
  });

  const onRefresh = useCallback(() => refetch(), [refetch]);

  if (isLoading) {
    return (
      <Screen title="Analiza">
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Analiza" onRefresh={onRefresh} refreshing={isRefetching}>
        <EmptyState text={`Błąd połączenia: ${(error as Error).message}`} />
      </Screen>
    );
  }

  const correlations = data?.correlations ?? {};
  const entries = Object.entries(correlations);

  return (
    <Screen title="Analiza" onRefresh={onRefresh} refreshing={isRefetching}>
      <Card title="Korelacja stresu (VAS) z metrykami">
        {entries.length === 0 && (
          <EmptyState text="Za mało wspólnych danych (ankiety + metryki) do policzenia korelacji." />
        )}
        {entries.map(([metric, v]) => (
          <View key={metric} style={styles.row}>
            <Text style={styles.metric}>{METRIC_LABELS[metric] ?? metric}</Text>
            <View style={styles.right}>
              <Text style={[styles.r, { color: corrColor(v.r) }]}>
                {v.r != null ? v.r.toFixed(2) : "—"}
              </Text>
              <Text style={styles.n}>n={v.n}</Text>
            </View>
          </View>
        ))}
      </Card>
      <Text style={styles.hint}>
        Wartości bliskie 1 lub -1 oznaczają silny związek ze stresem odczuwanym (VAS); n to liczba dni z pełnymi
        danymi.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metric: { color: colors.text, fontSize: 13, flexShrink: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  r: { fontWeight: "700", fontSize: 15 },
  n: { color: colors.muted, fontSize: 11 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
});
