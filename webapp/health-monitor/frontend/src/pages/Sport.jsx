import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from "recharts";
import MetricCard from "../components/MetricCard";
import { api } from "../api";

const SPORT_ICONS = {
  running: "🏃", trail_running: "🏃", treadmill_running: "🏃",
  cycling: "🚴", road_biking: "🚴", mountain_biking: "🚴", indoor_cycling: "🚴",
  swimming: "🏊", lap_swimming: "🏊", open_water_swimming: "🏊",
  walking: "🚶", hiking: "🥾",
  strength_training: "🏋️", cardio_training: "❤️",
  yoga: "🧘", fitness_equipment: "🏋️",
  // Mi Band (klucze z eksportu Mi Fitness)
  outdoor_running: "🏃", indoor_running: "🏃",
  outdoor_riding: "🚴", indoor_riding: "🚴",
  outdoor_walking: "🚶", outdoor_hiking: "🥾",
  outdoor_skating: "⛸️", zumba: "💃", free_training: "🏋️",
};
const sportIcon = (t) => SPORT_ICONS[t] || "🏅";
const sportLabel = (t) => (t || "unknown").replaceAll("_", " ");

function formatDuration(sec) {
  if (sec == null) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}
function formatDistance(m) {
  if (m == null) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function formatPace(avgSpeedMps) {
  if (!avgSpeedMps) return null;
  const secPerKm = 1000 / avgSpeedMps;
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
}

const ZONE_COLORS = ["var(--muted)", "var(--accent2)", "var(--accent)", "var(--warn)", "var(--danger)", "#c0392b"];

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

function ActivityDetails({ activityId, source }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getActivityDetails(activityId)
      .then(d => { if (!cancelled) setDetails(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [activityId]);

  if (error) return <div className="form-hint">Nie udało się pobrać szczegółów.</div>;
  if (!details) return <div className="form-hint">Ładowanie szczegółów…</div>;
  if (!details.has_details) {
    return (
      <div className="form-hint">
        {source === "miband"
          ? "Mi Band nie udostępnia w eksporcie splitów ani stref tętna dla treningów."
          : "Brak splitów/stref HR dla tej aktywności — jeszcze nie zsynchronizowane (patrz README: --details-backfill)."}
      </div>
    );
  }

  const zoneData = details.hr_zones.map(z => ({
    zone: `Z${z.zone ?? "?"}`,
    minuty: z.seconds != null ? +(z.seconds / 60).toFixed(1) : 0,
    zoneNum: z.zone,
  }));

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
      {details.splits.length > 0 && (
        <div style={{ marginBottom: zoneData.length > 0 ? 16 : 0, overflowX: "auto" }}>
          <div className="form-label" style={{ marginBottom: 8 }}>Splity</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                <th style={{ padding: "4px 8px 4px 0" }}>#</th>
                <th style={{ padding: "4px 8px" }}>Dystans</th>
                <th style={{ padding: "4px 8px" }}>Czas</th>
                <th style={{ padding: "4px 8px" }}>Tempo</th>
                <th style={{ padding: "4px 8px" }}>Śr. HR</th>
              </tr>
            </thead>
            <tbody>
              {details.splits.map(s => (
                <tr key={s.index} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "4px 8px 4px 0" }}>{s.index}</td>
                  <td style={{ padding: "4px 8px" }}>{formatDistance(s.distance_m) ?? "—"}</td>
                  <td style={{ padding: "4px 8px" }}>{formatDuration(s.duration_sec) ?? "—"}</td>
                  <td style={{ padding: "4px 8px" }}>{formatPace(s.avg_speed_mps) ?? "—"}</td>
                  <td style={{ padding: "4px 8px" }}>{s.avg_hr != null ? `${Math.round(s.avg_hr)} bpm` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {zoneData.length > 0 && (
        <div>
          <div className="form-label" style={{ marginBottom: 8 }}>Strefy tętna</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={zoneData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="zone" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="minuty" name="Minuty" radius={[4, 4, 0, 0]}>
                {zoneData.map((z, i) => (
                  <Cell key={i} fill={ZONE_COLORS[(z.zoneNum ?? i) % ZONE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const DAYS_OPTIONS = [
  { label: "30 dni", value: "30" },
  { label: "90 dni", value: "90" },
  { label: "365 dni", value: "365" },
  { label: "Wszystko", value: "" },
];

export default function Sport() {
  const [sportTypes, setSportTypes] = useState([]);
  const [sportType, setSportType] = useState("");
  const [days, setDays] = useState("90");
  const [summary, setSummary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.getSportTypes().then(setSportTypes).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const summaryParams = days ? { days } : {};
    const activityParams = { limit: 50, ...(days ? { days } : {}), ...(sportType ? { sport_type: sportType } : {}) };
    Promise.all([
      api.getActivitySummary(summaryParams),
      api.getActivities(activityParams),
    ])
      .then(([s, a]) => { setSummary(s); setActivities(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sportType, days]);

  const chartData = useMemo(() => {
    const weekly = summary?.weekly || [];
    const filtered = weekly.filter(w => !sportType || w.sport_type === sportType);
    const byWeek = {};
    for (const w of filtered) {
      const key = w.week;
      if (!byWeek[key]) byWeek[key] = { week: key, distance: 0 };
      byWeek[key].distance += Number(w.total_distance_m || 0);
    }
    return Object.values(byWeek)
      .sort((a, b) => a.week.localeCompare(b.week))
      .map(w => ({ week: w.week.slice(5), "Dystans (km)": +(w.distance / 1000).toFixed(1) }));
  }, [summary, sportType]);

  const bySport = summary?.by_sport || [];

  const selectStyle = {
    background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: 8, color: "var(--text)", fontFamily: "inherit",
    fontSize: "0.9rem", padding: "8px 10px",
  };

  if (loading && !summary) return <div className="empty">Ładowanie…</div>;

  return (
    <div className="page">
      <div className="page-title">Sport 🏃</div>

      <div style={{ display: "flex", gap: 10, marginBottom: "var(--gap)" }}>
        <select style={{ ...selectStyle, flex: 1 }} value={sportType} onChange={e => setSportType(e.target.value)}>
          <option value="">Wszystkie dyscypliny</option>
          {sportTypes.map(t => (
            <option key={t} value={t}>{sportIcon(t)} {sportLabel(t)}</option>
          ))}
        </select>
        <select style={{ ...selectStyle, flex: 1 }} value={days} onChange={e => setDays(e.target.value)}>
          {DAYS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {bySport.length === 0 ? (
        <div className="empty">
          Brak zsynchronizowanych aktywności.<br />
          Skonfiguruj GARMIN_EMAIL/GARMIN_PASSWORD i poczekaj na sync,
          albo uruchom pełny backfill (patrz README).
        </div>
      ) : (
        <>
          <div className="metric-grid">
            {bySport
              .filter(s => !sportType || s.sport_type === sportType)
              .map(s => (
                <MetricCard
                  key={s.sport_type}
                  icon={sportIcon(s.sport_type)}
                  label={sportLabel(s.sport_type)}
                  color="var(--accent)"
                  value={s.sessions}
                  unit="treningów"
                  sub={[formatDistance(s.total_distance_m), formatDuration(s.total_duration_sec)]
                    .filter(Boolean).join(" · ") || null}
                />
              ))}
          </div>

          {chartData.length > 0 && (
            <div className="chart-wrap">
              <div className="card-title">
                Dystans — trend tygodniowy ({sportType ? sportLabel(sportType) : "wszystkie dyscypliny"})
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Dystans (km)" stroke="var(--accent)"
                    strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <div className="card-title">Ostatnie aktywności</div>
            {activities.length === 0 ? (
              <div className="empty">Brak aktywności w wybranym zakresie.</div>
            ) : (
              activities.map(a => (
                <div
                  className="survey-item"
                  key={a.id}
                  style={{ cursor: "pointer", gridTemplateColumns: expandedId === a.id ? "1fr" : "auto 1fr" }}
                  onClick={() => setExpandedId(prev => prev === a.id ? null : a.id)}
                >
                  <div style={{ display: "flex", gap: 12 }}>
                    <div>
                      <div className="survey-date">
                        {new Date(a.start_time).toLocaleDateString("pl-PL")}
                      </div>
                      <div style={{ fontSize: "1.1rem", marginTop: 4 }}>{sportIcon(a.sport_type)}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{a.name || sportLabel(a.sport_type)}</span>
                        <span className={`badge badge-${a.source}`}>{a.source}</span>
                      </div>
                      <div className="survey-pills">
                        {a.distance_m != null && <span className="pill">📏 {formatDistance(a.distance_m)}</span>}
                        {a.duration_sec != null && <span className="pill">⏱ {formatDuration(a.duration_sec)}</span>}
                        {a.avg_hr != null && <span className="pill">❤️ {Math.round(a.avg_hr)} bpm</span>}
                        {a.calories != null && <span className="pill">🔥 {Math.round(a.calories)} kcal</span>}
                      </div>
                    </div>
                  </div>
                  {expandedId === a.id && <ActivityDetails activityId={a.id} source={a.source} />}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
