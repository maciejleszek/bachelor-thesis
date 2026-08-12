import { useCallback } from "react";
import { StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { api } from "../api/endpoints";
import Screen, { Card, EmptyState } from "../components/Screen";
import { colors } from "../theme/colors";

function fmtDuration(sec?: number | null): string {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function fmtDistance(m?: number | null): string {
  if (!m) return "—";
  return (m / 1000).toFixed(2) + " km";
}

export default function SportScreen() {
  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.getActivities({ days: 90, limit: 50 }),
  });

  const onRefresh = useCallback(() => refetch(), [refetch]);

  if (isLoading) {
    return (
      <Screen title="Sport">
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Sport" onRefresh={onRefresh} refreshing={isRefetching}>
        <EmptyState text={`Błąd połączenia: ${(error as Error).message}`} />
      </Screen>
    );
  }

  const activities = data ?? [];

  return (
    <Screen title="Sport" onRefresh={onRefresh} refreshing={isRefetching}>
      {activities.length === 0 && <EmptyState text="Brak aktywności z ostatnich 90 dni." />}
      {activities.map((a) => (
        <Card key={a.id}>
          <View style={styles.rowTop}>
            <Text style={styles.name} numberOfLines={1}>{a.name || a.sport_type}</Text>
            <Text style={styles.date}>{new Date(a.start_time).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.sportType}>{a.sport_type}</Text>
          <View style={styles.statsRow}>
            <Stat label="Czas" value={fmtDuration(a.duration_sec)} />
            <Stat label="Dystans" value={fmtDistance(a.distance_m)} />
            <Stat label="Kalorie" value={a.calories ? `${Math.round(a.calories)} kcal` : "—"} />
            <Stat label="Śr. HR" value={a.avg_hr ? `${Math.round(a.avg_hr)} bpm` : "—"} />
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
  name: { color: colors.text, fontWeight: "600", fontSize: 14, flexShrink: 1 },
  date: { color: colors.muted, fontSize: 11 },
  sportType: { color: colors.accent, fontSize: 11, textTransform: "uppercase", marginTop: 2 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  stat: { alignItems: "center", flex: 1 },
  statValue: { color: colors.text, fontWeight: "700", fontSize: 13 },
  statLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },
});
