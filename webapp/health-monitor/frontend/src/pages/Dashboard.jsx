import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from "recharts";
import MetricCard from "../components/MetricCard";
import { api } from "../api";

function fmt(val, dec = 0) {
  if (val == null) return null;
  return Number(val).toFixed(dec);
}

function stressColor(v) {
  if (v == null) return "var(--muted)";
  if (v < 35)   return "var(--accent2)";
  if (v < 60)   return "var(--warn)";
  return "var(--danger)";
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 12px", fontSize: "0.8rem" }}>
      <div style={{ color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.stroke }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSummary()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty">Ładowanie…</div>;

  // Latest entry (prefer garmin, fallback miband)
  const metrics = data?.metrics || [];
  const latest = metrics.find(m => m.source === "garmin") || metrics[0] || {};
  const latestSurvey = data?.surveys?.[0] || {};
  const latestBP = data?.blood_pressure?.[0] || {};

  // Chart data (last 7 days HR + stress)
  const chartData = [...metrics]
    .reverse()
    .map(m => ({
      date: m.date?.slice(5),
      HR:   fmt(m.avg_hr, 0),
      Stres: fmt(m.avg_stress, 0),
      HRV:  fmt(m.hrv, 1),
    }));

  const sleepH = latest.sleep_total_min
    ? (latest.sleep_total_min / 60).toFixed(1) : null;

  return (
    <div className="page">
      <div className="page-title">Dashboard 📊</div>

      {/* ── Metric cards ── */}
      <div className="metric-grid">
        <MetricCard
          icon="❤️" label="Tętno śr." color="var(--danger)"
          value={fmt(latest.avg_hr, 0)} unit="bpm"
          sub={latest.resting_hr ? `Spocz. ${fmt(latest.resting_hr,0)} bpm` : null}
        />
        <MetricCard
          icon="💚" label="HRV" color="var(--accent2)"
          value={fmt(latest.hrv, 1)} unit="ms"
        />
        <MetricCard
          icon="🫁" label="SpO₂" color="var(--accent)"
          value={fmt(latest.spo2, 1)} unit="%"
        />
        <MetricCard
          icon="😰" label="Stres śr." color={stressColor(latest.avg_stress)}
          value={fmt(latest.avg_stress, 0)} unit="/100"
          sub={latest.max_stress ? `Max ${fmt(latest.max_stress,0)}` : null}
        />
        <MetricCard
          icon="👣" label="Kroki" color="var(--warn)"
          value={latest.steps?.toLocaleString()} unit=""
        />
        <MetricCard
          icon="🌙" label="Sen" color="#9c8fff"
          value={sleepH} unit="h"
          sub={latest.sleep_deep_min
            ? `Głęboki ${Math.round(latest.sleep_deep_min)} min` : null}
        />
      </div>

      {/* ── BP + survey row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <MetricCard
          icon="🩺" label="Ciśnienie"
          value={latestBP.sys && latestBP.dia ? `${latestBP.sys}/${latestBP.dia}` : null}
          unit="mmHg"
        />
        <MetricCard
          icon="🎭" label="Stres (VAS)"
          value={latestSurvey.vas_stress ?? null} unit="/100"
          sub={latestSurvey.sam_valence != null
            ? `Nastrój ${latestSurvey.sam_valence}/9` : null}
        />
      </div>

      {/* ── HR + Stress chart ── */}
      {chartData.length > 0 && (
        <div className="chart-wrap">
          <div className="card-title">Tętno i stres — 7 dni</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
              <Line type="monotone" dataKey="HR" name="HR" stroke="var(--danger)"
                strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Stres" name="Stres" stroke="var(--warn)"
                strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── HRV chart ── */}
      {chartData.length > 0 && (
        <div className="chart-wrap">
          <div className="card-title">HRV — 7 dni</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="HRV" name="HRV" stroke="var(--accent2)"
                strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {metrics.length === 0 && (
        <div className="empty">
          Brak danych.<br />Dodaj metryki przez zakładkę <strong>Dane</strong>.
        </div>
      )}
    </div>
  );
}
