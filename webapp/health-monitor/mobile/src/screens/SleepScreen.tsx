import { useCallback } from "react";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { api } from "../api/endpoints";
import Screen, { Card, EmptyState } from "../components/Screen";
import { colors } from "../theme/colors";

function minToH(min?: number | null): string {
  if (min == null) return "—";
  return (min / 60).toFixed(1) + " h";
}

const SLEEP_DAYS = 365;
const SLEEP_LIMIT = 30;

export default function SleepScreen() {
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["metrics", "sleep", SLEEP_DAYS],
    queryFn: () => api.getMetrics({ days: SLEEP_DAYS }),
  });

  const onRefresh = useCallback(() => refetch(), [refetch]);

  if (isLoading) {
    return (
      <Screen title="Sen">
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Sen" onRefresh={onRefresh} refreshing={isRefetching}>
        <EmptyState text={`Błąd połączenia: ${(error as Error).message}`} />
      </Screen>
    );
  }

  // Pokazujemy tylko dni z realnym zapisem snu - w tym zbiorze danych
  // opaska (Garmin) często ma dziury, więc filtrowanie po dacie samej w
  // sobie zwracało puste karty.
  const days = (data ?? []).filter((d) => d.sleep_total_min != null).slice(0, SLEEP_LIMIT);

  return (
    <Screen title="Sen" onRefresh={onRefresh} refreshing={isRefetching}>
      {days.length === 0 && (
        <EmptyState text={`Brak zapisanego snu w ostatnich ${SLEEP_DAYS} dniach.`} />
      )}
      {days.map((d) => (
        <Card key={`${d.date}-${d.source}`}>
          <View style={styles.rowTop}>
            <Text style={styles.date}>{d.date}</Text>
            <Text style={styles.source}>{d.source}</Text>
          </View>
          <View style={styles.statsRow}>
            <Stat label="Razem" value={minToH(d.sleep_total_min)} />
            <Stat label="Głęboki" value={d.sleep_deep_min != null ? `${Math.round(d.sleep_deep_min)} min` : "—"} />
            <Stat label="REM" value={d.sleep_rem_min != null ? `${Math.round(d.sleep_rem_min)} min` : "—"} />
            <Stat label="Wynik" value={d.sleep_score != null ? `${Math.round(d.sleep_score)}` : "—"} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { color: colors.text, fontWeight: "600", fontSize: 14 },
  source: { color: colors.muted, fontSize: 11, textTransform: "uppercase" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  stat: { alignItems: "center", flex: 1 },
  statValue: { color: colors.violet, fontWeight: "700", fontSize: 15 },
  statLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },
});
