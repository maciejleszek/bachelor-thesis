import { useCallback } from "react";
import { StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { LineChart } from "react-native-gifted-charts";

import { api } from "../api/endpoints";
import Screen, { Card, EmptyState } from "../components/Screen";
import MetricCard from "../components/MetricCard";
import { colors } from "../theme/colors";
import type { DailyMetric } from "../api/types";

const METRICS_DAYS = 90;

function fmt(val: number | null | undefined, dec = 0): string | null {
  if (val == null) return null;
  return Number(val).toFixed(dec);
}

function stressColor(v: number | null | undefined): string {
  if (v == null) return colors.muted;
  if (v < 35) return colors.accent2;
  if (v < 60) return colors.warn;
  return colors.danger;
}

// Metryki bywają puste dla ostatnich dni (przerwa w synchronizacji zegarka),
// więc do kart pokazujemy najnowszy dzień, który faktycznie ma jakiekolwiek dane.
function findLatestWithData(metrics: DailyMetric[]): DailyMetric {
  const withData = metrics.find(
    (m) => m.avg_hr != null || m.hrv != null || m.steps != null || m.sleep_total_min != null || m.spo2 != null
  );
  return withData ?? metrics[0] ?? {} as DailyMetric;
}

function buildSeries(metrics: DailyMetric[], key: keyof DailyMetric, decimals = 0) {
  return [...metrics]
    .reverse()
    .filter((m) => m[key] != null)
    .map((m) => ({ value: Number(fmt(m[key] as number, decimals)), label: m.date?.slice(5) }));
}

export default function DashboardScreen() {
  const summaryQuery = useQuery({ queryKey: ["summary"], queryFn: api.getSummary });
  const metricsQuery = useQuery({
    queryKey: ["metrics", "dashboard", METRICS_DAYS],
    queryFn: () => api.getMetrics({ days: METRICS_DAYS }),
  });

  const isLoading = summaryQuery.isLoading || metricsQuery.isLoading;
  const isRefetching = summaryQuery.isRefetching || metricsQuery.isRefetching;
  const error = summaryQuery.error || metricsQuery.error;

  const onRefresh = useCallback(() => {
    summaryQuery.refetch();
    metricsQuery.refetch();
  }, [summaryQuery, metricsQuery]);

  if (isLoading) {
    return (
      <Screen title="Dashboard">
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Dashboard" onRefresh={onRefresh} refreshing={isRefetching}>
        <EmptyState text={`Nie udało się połączyć z serwerem.\n${(error as Error).message}\n\nSprawdź adres API w zakładce Ustawienia.`} />
      </Screen>
    );
  }

  const metrics = metricsQuery.data ?? [];
  const latest = findLatestWithData(metrics);
  const latestSurvey = summaryQuery.data?.surveys?.[0];
  const latestBp = summaryQuery.data?.blood_pressure?.[0];

  const sleepH = latest.sleep_total_min ? (latest.sleep_total_min / 60).toFixed(1) : null;

  const hrSeries = buildSeries(metrics, "avg_hr");
  const hrvSeries = buildSeries(metrics, "hrv", 1);

  return (
    <Screen title="Dashboard" onRefresh={onRefresh} refreshing={isRefetching}>
      {latest.date && (
        <Text style={styles.latestDate}>Najnowszy pomiar: {latest.date} ({latest.source})</Text>
      )}
      <View style={styles.grid}>
        <MetricCard icon="❤️" label="Tętno śr." color={colors.danger}
          value={fmt(latest.avg_hr, 0)} unit="bpm"
          sub={latest.resting_hr ? `Spocz. ${fmt(latest.resting_hr, 0)} bpm` : null} />
        <MetricCard icon="💚" label="HRV" color={colors.accent2}
          value={fmt(latest.hrv, 1)} unit="ms" />
        <MetricCard icon="🫁" label="SpO₂" color={colors.accent}
          value={fmt(latest.spo2, 1)} unit="%" />
        <MetricCard icon="😰" label="Stres śr." color={stressColor(latest.avg_stress)}
          value={fmt(latest.avg_stress, 0)} unit="/100"
          sub={latest.max_stress ? `Max ${fmt(latest.max_stress, 0)}` : null} />
        <MetricCard icon="👣" label="Kroki" color={colors.warn}
          value={latest.steps?.toLocaleString()} />
        <MetricCard icon="🌙" label="Sen" color={colors.violet}
          value={sleepH} unit="h"
          sub={latest.sleep_deep_min ? `Głęboki ${Math.round(latest.sleep_deep_min)} min` : null} />
      </View>

      <View style={styles.row}>
        <MetricCard icon="🩺" label="Ciśnienie"
          value={latestBp?.sys && latestBp?.dia ? `${latestBp.sys}/${latestBp.dia}` : null} unit="mmHg" />
        <MetricCard icon="🎭" label="Stres (VAS)"
          value={latestSurvey?.vas_stress ?? null} unit="/100"
          sub={latestSurvey?.sam_valence != null ? `Nastrój ${latestSurvey.sam_valence}/9` : null} />
      </View>

      {hrSeries.length > 0 && (
        <Card title={`Tętno — ostatnie ${hrSeries.length} pomiarów`}>
          <LineChart
            data={hrSeries}
            height={140}
            color={colors.danger}
            thickness={2}
            hideDataPoints
            yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
            noOfSections={4}
            rulesColor={colors.border}
            yAxisColor={colors.border}
            xAxisColor={colors.border}
          />
        </Card>
      )}
      {hrvSeries.length > 0 && (
        <Card title={`HRV — ostatnie ${hrvSeries.length} pomiarów`}>
          <LineChart
            data={hrvSeries}
            height={120}
            color={colors.accent2}
            thickness={2}
            dataPointsColor={colors.accent2}
            yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
            noOfSections={4}
            rulesColor={colors.border}
            yAxisColor={colors.border}
            xAxisColor={colors.border}
          />
        </Card>
      )}
      {metrics.length === 0 && (
        <EmptyState text={"Brak danych.\nDodaj metryki z poziomu backendu (sync Garmin/Mi Band)."} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  latestDate: { color: colors.muted, fontSize: 12, marginTop: -6 },
});
