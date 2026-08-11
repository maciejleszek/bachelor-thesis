import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Scatter, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid
} from "recharts";
import { api } from "../api";

const METRICS = [
  { key: "hrv",             label: "HRV",                unit: "ms" },
  { key: "resting_hr",      label: "Tętno spoczynkowe",  unit: "bpm" },
  { key: "sleep_score",     label: "Sleep score",        unit: "/100" },
  { key: "sleep_total_min", label: "Sen (czas)",         unit: "min" },
  { key: "spo2",            label: "SpO₂",               unit: "%" },
  { key: "avg_stress",      label: "Stres (Garmin)",     unit: "/100" },
];
const metricLabel = (key) => METRICS.find(m => m.key === key)?.label || key;
const metricUnit = (key) => METRICS.find(m => m.key === key)?.unit || "";

const RECOVERY_METRICS = [
  { key: "next_vas_stress",  label: "Stres nast. dnia (ankieta)", unit: "/100" },
  { key: "next_sleep_score", label: "Sleep score nast. nocy",     unit: "/100" },
  { key: "next_resting_hr",  label: "Tętno spocz. nast. dnia",    unit: "bpm" },
  { key: "next_hrv",         label: "HRV nast. dnia",             unit: "ms" },
];
const recoveryLabel = (key) => RECOVERY_METRICS.find(m => m.key === key)?.label || key;
const recoveryUnit = (key) => RECOVERY_METRICS.find(m => m.key === key)?.unit || "";

const DAYS_OPTIONS = [
  { label: "90 dni", value: "90" },
  { label: "365 dni", value: "365" },
  { label: "Wszystko", value: "" },
];

function interpretR(r) {
  if (r == null) return { label: "brak danych", color: "var(--muted)" };
  const abs = Math.abs(r);
  const strength = abs < 0.1 ? "brak" : abs < 0.3 ? "słaba" : abs < 0.5 ? "umiarkowana" : abs < 0.7 ? "silna" : "bardzo silna";
  const direction = r > 0 ? "dodatnia" : r < 0 ? "ujemna" : "";
  const color = abs < 0.1 ? "var(--muted)" : abs < 0.3 ? "var(--warn)" : "var(--danger)";
  return { label: strength === "brak" ? "brak korelacji" : `${strength} ${direction}`, color };
}

function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem" }}>
      {label != null && <div style={{ color: "var(--muted)", marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.stroke || p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function Analysis() {
  const [days, setDays] = useState("365");
  const [metric, setMetric] = useState("hrv");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMetric, setRecoveryMetric] = useState("next_vas_stress");
  const [recovery, setRecovery] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.getCorrelation(days ? { days } : {})
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
    api.getTrainingRecovery(days ? { days } : {})
      .then(setRecovery)
      .catch(() => {});
  }, [days]);

  const scatterData = useMemo(() => {
    if (!data) return [];
    return data.pairs
      .filter(p => p.vas_stress != null && p[metric] != null)
      .map(p => ({ x: Number(p.vas_stress), y: Number(p[metric]) }));
  }, [data, metric]);

  const trend = useMemo(() => linearRegression(scatterData), [scatterData]);
  const trendLine = useMemo(() => {
    if (!trend || scatterData.length === 0) return [];
    const xs = scatterData.map(p => p.x);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    return [
      { x: minX, y: +(trend.slope * minX + trend.intercept).toFixed(2) },
      { x: maxX, y: +(trend.slope * maxX + trend.intercept).toFixed(2) },
    ];
  }, [trend, scatterData]);

  const timeSeries = useMemo(() => {
    if (!data) return [];
    return data.pairs
      .filter(p => p[metric] != null || p.vas_stress != null)
      .map(p => ({
        date: p.date?.slice(5),
        Stres: p.vas_stress != null ? Number(p.vas_stress) : null,
        [metricLabel(metric)]: p[metric] != null ? Number(p[metric]) : null,
      }));
  }, [data, metric]);

  const recoveryScatter = useMemo(() => {
    if (!recovery) return [];
    return recovery.pairs
      .filter(p => p.training_load != null && p[recoveryMetric] != null)
      .map(p => ({ x: Number(p.training_load), y: Number(p[recoveryMetric]) }));
  }, [recovery, recoveryMetric]);

  const recoveryTrend = useMemo(() => linearRegression(recoveryScatter), [recoveryScatter]);
  const recoveryTrendLine = useMemo(() => {
    if (!recoveryTrend || recoveryScatter.length === 0) return [];
    const xs = recoveryScatter.map(p => p.x);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    return [
      { x: minX, y: +(recoveryTrend.slope * minX + recoveryTrend.intercept).toFixed(2) },
      { x: maxX, y: +(recoveryTrend.slope * maxX + recoveryTrend.intercept).toFixed(2) },
    ];
  }, [recoveryTrend, recoveryScatter]);

  const recoveryCorrelations = recovery?.correlations || {};
  const hasRecoveryData = Object.values(recoveryCorrelations).some(c => c.n >= 3);

  const selectStyle = {
    background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: 8, color: "var(--text)", fontFamily: "inherit",
    fontSize: "0.9rem", padding: "8px 10px",
  };

  if (loading && !data) return <div className="empty">Ładowanie…</div>;

  const correlations = data?.correlations || {};
  const hasEnoughData = Object.values(correlations).some(c => c.n >= 3);

  return (
    <div className="page">
      <div className="page-title">Analiza 📈</div>

      <div style={{ display: "flex", gap: 10, marginBottom: "var(--gap)" }}>
        <select style={{ ...selectStyle, flex: 1 }} value={metric} onChange={e => setMetric(e.target.value)}>
          {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <select style={{ ...selectStyle, flex: 1 }} value={days} onChange={e => setDays(e.target.value)}>
          {DAYS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!hasEnoughData ? (
        <div className="empty">
          Za mało sparowanych dni (ankieta + dane Garmina tego samego dnia),
          żeby policzyć korelację.<br />
          Wypełniaj ankietę SAM+VAS regularnie i poczekaj na sync/backfill Garmina.
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: "var(--gap)" }}>
            <div className="card-title">Korelacja stresu (VAS) z metrykami</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th style={{ padding: "4px 8px 4px 0" }}>Metryka</th>
                  <th style={{ padding: "4px 8px" }}>r</th>
                  <th style={{ padding: "4px 8px" }}>n</th>
                  <th style={{ padding: "4px 8px" }}>Interpretacja</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map(m => {
                  const c = correlations[m.key] || { r: null, n: 0 };
                  const info = interpretR(c.r);
                  return (
                    <tr key={m.key} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px 6px 0" }}>{m.label}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{c.r ?? "—"}</td>
                      <td style={{ padding: "6px 8px", color: "var(--muted)" }}>{c.n}</td>
                      <td style={{ padding: "6px 8px", color: info.color }}>{info.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {scatterData.length > 0 && (
            <div className="chart-wrap">
              <div className="card-title">Stres (VAS) vs {metricLabel(metric)}</div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="x" type="number" name="Stres" domain={[0, 100]}
                    tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis dataKey="y" type="number" name={metricLabel(metric)}
                    tick={{ fill: "var(--muted)", fontSize: 11 }} unit={metricUnit(metric)} />
                  <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={scatterData} fill="var(--accent)" />
                  {trendLine.length === 2 && (
                    <Line data={trendLine} dataKey="y" stroke="var(--danger)"
                      strokeWidth={2} dot={false} legendType="none" isAnimationActive={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              <div className="form-hint">Oś X: stres z ankiety (0-100) · Oś Y: {metricLabel(metric)} ({metricUnit(metric)}) · czerwona linia = trend</div>
            </div>
          )}

          {timeSeries.length > 0 && (
            <div className="chart-wrap">
              <div className="card-title">Stres i {metricLabel(metric)} w czasie</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={timeSeries} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis yAxisId="left" domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
                  <Line yAxisId="left" type="monotone" dataKey="Stres" stroke="var(--warn)"
                    strokeWidth={2} dot={{ r: 2 }} connectNulls />
                  <Line yAxisId="right" type="monotone" dataKey={metricLabel(metric)} stroke="var(--accent)"
                    strokeWidth={2} dot={{ r: 2 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="page-title" style={{ fontSize: "1.1rem", marginTop: 28 }}>Trening a regeneracja</div>
          <div className="form-hint" style={{ marginBottom: 12 }}>
            Czy dzienne obciążenie treningowe (suma training load z aktywności) wiąże się
            z regeneracją następnego dnia?
          </div>

          {!hasRecoveryData ? (
            <div className="empty">
              Za mało dni z treningiem i danymi z dnia następnego, żeby policzyć korelację.
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: "var(--gap)" }}>
                <div className="card-title">Korelacja obciążenia treningowego z regeneracją</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                      <th style={{ padding: "4px 8px 4px 0" }}>Metryka (dzień +1)</th>
                      <th style={{ padding: "4px 8px" }}>r</th>
                      <th style={{ padding: "4px 8px" }}>n</th>
                      <th style={{ padding: "4px 8px" }}>Interpretacja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECOVERY_METRICS.map(m => {
                      const c = recoveryCorrelations[m.key] || { r: null, n: 0 };
                      const info = interpretR(c.r);
                      return (
                        <tr key={m.key} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "6px 8px 6px 0" }}>{m.label}</td>
                          <td style={{ padding: "6px 8px", fontWeight: 600 }}>{c.r ?? "—"}</td>
                          <td style={{ padding: "6px 8px", color: "var(--muted)" }}>{c.n}</td>
                          <td style={{ padding: "6px 8px", color: info.color }}>{info.label}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <select style={{ ...selectStyle, width: "100%", marginBottom: 12 }}
                value={recoveryMetric} onChange={e => setRecoveryMetric(e.target.value)}>
                {RECOVERY_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>

              {recoveryScatter.length > 0 && (
                <div className="chart-wrap">
                  <div className="card-title">Obciążenie treningowe vs {recoveryLabel(recoveryMetric)}</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="x" type="number" name="Obciążenie"
                        tick={{ fill: "var(--muted)", fontSize: 11 }} />
                      <YAxis dataKey="y" type="number" name={recoveryLabel(recoveryMetric)}
                        tick={{ fill: "var(--muted)", fontSize: 11 }} unit={recoveryUnit(recoveryMetric)} />
                      <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter data={recoveryScatter} fill="var(--danger)" />
                      {recoveryTrendLine.length === 2 && (
                        <Line data={recoveryTrendLine} dataKey="y" stroke="var(--accent)"
                          strokeWidth={2} dot={false} legendType="none" isAnimationActive={false} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="form-hint">
                    Oś X: training load dnia treningowego · Oś Y: {recoveryLabel(recoveryMetric)} dnia następnego
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
