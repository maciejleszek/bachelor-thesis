import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid
} from "recharts";
import MetricCard from "../components/MetricCard";
import { api } from "../api";

const DAYS_OPTIONS = [
  { label: "30 dni", value: "30" },
  { label: "90 dni", value: "90" },
  { label: "365 dni", value: "365" },
  { label: "Wszystko", value: "3650" },
];

function fmt(val, dec = 0) {
  if (val == null) return null;
  return Number(val).toFixed(dec);
}
function avg(nums) {
  const vals = nums.filter(n => n != null && !isNaN(n));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + Number(b), 0) / vals.length;
}
function hoursMin(min) {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}min`;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem" }}>
      <div style={{ color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.fill || p.stroke }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function Sleep() {
  const [source, setSource] = useState("");
  const [days, setDays] = useState("90");
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getMetrics({ source, days })
      .then(setMetrics)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [source, days]);

  const nights = useMemo(() =>
    [...metrics]
      .filter(m => m.sleep_total_min != null)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [metrics]
  );

  const summary = useMemo(() => {
    const totalMin = avg(nights.map(n => n.sleep_total_min));
    const score = avg(nights.map(n => n.sleep_score));
    const deepPct = avg(nights.map(n =>
      n.sleep_total_min ? (n.sleep_deep_min / n.sleep_total_min) * 100 : null));
    const remPct = avg(nights.map(n =>
      n.sleep_total_min ? (n.sleep_rem_min / n.sleep_total_min) * 100 : null));
    return { totalMin, score, deepPct, remPct, count: nights.length };
  }, [nights]);

  const chartData = useMemo(() =>
    nights.slice(-30).map(n => ({
      date: n.date?.slice(5),
      "Głęboki": n.sleep_deep_min ?? 0,
      "Płytki": n.sleep_light_min ?? 0,
      "REM": n.sleep_rem_min ?? 0,
    })),
    [nights]
  );

  const scoreData = useMemo(() =>
    nights.filter(n => n.sleep_score != null).map(n => ({
      date: n.date?.slice(5),
      "Sleep score": Number(n.sleep_score),
    })),
    [nights]
  );

  const selectStyle = {
    background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: 8, color: "var(--text)", fontFamily: "inherit",
    fontSize: "0.9rem", padding: "8px 10px",
  };

  if (loading && metrics.length === 0) return <div className="empty">Ładowanie…</div>;

  return (
    <div className="page">
      <div className="page-title">Sen 🌙</div>

      <div style={{ display: "flex", gap: 10, marginBottom: "var(--gap)" }}>
        <select style={{ ...selectStyle, flex: 1 }} value={source} onChange={e => setSource(e.target.value)}>
          <option value="">Garmin + Mi Band</option>
          <option value="garmin">Tylko Garmin</option>
          <option value="miband">Tylko Mi Band</option>
        </select>
        <select style={{ ...selectStyle, flex: 1 }} value={days} onChange={e => setDays(e.target.value)}>
          {DAYS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {nights.length === 0 ? (
        <div className="empty">
          Brak danych o śnie w wybranym zakresie.<br />
          Poczekaj na sync z Garmina (albo wrzuć eksport Mi Band) — patrz README.
        </div>
      ) : (
        <>
          <div className="metric-grid">
            <MetricCard icon="🌙" label="Śr. czas snu" color="#9c8fff"
              value={hoursMin(summary.totalMin)} unit="" />
            <MetricCard icon="💯" label="Śr. sleep score" color="var(--accent2)"
              value={fmt(summary.score, 0)} unit="/100" />
            <MetricCard icon="🌊" label="Śr. głęboki sen" color="var(--accent)"
              value={fmt(summary.deepPct, 0)} unit="%" />
            <MetricCard icon="👁️" label="Śr. REM" color="var(--warn)"
              value={fmt(summary.remPct, 0)} unit="%" />
            <MetricCard icon="📅" label="Nocy z danymi" color="var(--muted)"
              value={summary.count} unit="" />
          </div>

          {chartData.length > 0 && (
            <div className="chart-wrap">
              <div className="card-title">Skład snu — ostatnie {chartData.length} nocy</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} unit="min" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
                  <Bar dataKey="Głęboki" stackId="sleep" fill="var(--accent)" />
                  <Bar dataKey="Płytki" stackId="sleep" fill="#6b7394" />
                  <Bar dataKey="REM" stackId="sleep" fill="#9c8fff" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {scoreData.length > 0 && (
            <div className="chart-wrap">
              <div className="card-title">Sleep score — trend</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={scoreData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Sleep score" stroke="var(--accent2)"
                    strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
