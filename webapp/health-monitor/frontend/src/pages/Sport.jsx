import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid
} from "recharts";
import MetricCard from "../components/MetricCard";
import { api } from "../api";
import { useInterval } from "../hooks/useInterval";

const REFRESH_MS = 5 * 60 * 1000;

const VOLUME_COLORS = ["var(--accent)", "var(--accent2)", "var(--warn)", "var(--danger)", "#9c8fff", "var(--muted)"];

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
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.getSportTypes().then(setSportTypes).catch(() => {});
  }, []);

  useEffect(() => {
    api.getActivityRecords(sportType ? { sport_type: sportType } : {})
      .then(setRecords)
      .catch(() => setRecords(null));
  }, [sportType]);

  function loadActivities() {
    const summaryParams = days ? { days } : {};
    const activityParams = { limit: 50, ...(days ? { days } : {}), ...(sportType ? { sport_type: sportType } : {}) };
    return Promise.all([
      api.getActivitySummary(summaryParams),
      api.getActivities(activityParams),
    ]).then(([s, a]) => { setSummary(s); setActivities(a); });
  }

  useInterval(loadActivities, REFRESH_MS);

  useEffect(() => {
    setLoading(true);
    loadActivities()
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

  const loadTrendData = useMemo(() => {
    return [...activities]
      .filter(a => a.training_load != null)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map(a => ({
        date: new Date(a.start_time).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" }),
        "Obciążenie": Number(a.training_load),
      }));
  }, [activities]);

  const weeklyVolume = useMemo(() => {
    if (sportType) return { data: [], sports: [] };
    const weekly = summary?.weekly || [];
    const totals = {};
    for (const w of weekly) {
      totals[w.sport_type] = (totals[w.sport_type] || 0) + Number(w.total_duration_sec || 0);
    }
    const topSports = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s]) => s);

    const weekMap = {};
    for (const w of weekly) {
      const key = w.week;
      if (!weekMap[key]) weekMap[key] = { week: key };
      const label = topSports.includes(w.sport_type) ? sportLabel(w.sport_type) : "inne";
      const hours = Number(w.total_duration_sec || 0) / 3600;
      weekMap[key][label] = +((weekMap[key][label] || 0) + hours).toFixed(2);
    }
    const sportsPresent = new Set();
    Object.values(weekMap).forEach(w => Object.keys(w).forEach(k => { if (k !== "week") sportsPresent.add(k); }));

    return {
      data: Object.values(weekMap)
        .sort((a, b) => a.week.localeCompare(b.week))
        .map(w => ({ ...w, week: w.week.slice(5) })),
      sports: Array.from(sportsPresent),
    };
  }, [summary, sportType]);

  const bySport = summary?.by_sport || [];

  const RECORD_LABELS = {
    distance_m:    { icon: "📏", label: "Najdłuższy dystans", format: r => formatDistance(r.value) },
    duration_sec:  { icon: "⏱",  label: "Najdłuższy trening", format: r => formatDuration(r.value) },
    calories:      { icon: "🔥", label: "Najwięcej kalorii",  format: r => `${Math.round(r.value)} kcal` },
    avg_speed_mps: { icon: "⚡", label: "Najszybsze tempo",   format: r => formatPace(r.value) },
  };

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

          {records && Object.values(records.records).some(Boolean) && (
            <div className="card" style={{ marginBottom: "var(--gap)" }}>
              <div className="card-title">
                Rekordy życiowe {sportType ? `— ${sportLabel(sportType)}` : "(wszystkie dyscypliny)"}
              </div>
              <div className="metric-grid" style={{ marginBottom: 0 }}>
                {Object.entries(RECORD_LABELS).map(([key, cfg]) => {
                  const r = records.records[key];
                  if (!r) return null;
                  return (
                    <MetricCard
                      key={key}
                      icon={cfg.icon}
                      label={cfg.label}
                      color="var(--warn)"
                      value={cfg.format(r)}
                      unit=""
                      sub={`${r.name || sportLabel(r.sport_type)} · ${new Date(r.start_time).toLocaleDateString("pl-PL")}`}
                    />
                  );
                })}
              </div>
            </div>
          )}

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

          {loadTrendData.length > 0 && (
            <div className="chart-wrap">
              <div className="card-title">
                Obciążenie treningowe — trend ({sportType ? sportLabel(sportType) : "wszystkie dyscypliny"})
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={loadTrendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="Obciążenie" stroke="var(--danger)"
                    strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="form-hint">
                Training load wg Garmina/Mi Banda — im wyżej, tym większy wysiłek fizjologiczny treningu.
              </div>
            </div>
          )}

          {weeklyVolume.data.length > 0 && (
            <div className="chart-wrap">
              <div className="card-title">Objętość treningowa tygodniowo (godziny, wg dyscypliny)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyVolume.data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} unit="h" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted)" }} />
                  {weeklyVolume.sports.map((s, i) => (
                    <Bar key={s} dataKey={s} stackId="vol" fill={VOLUME_COLORS[i % VOLUME_COLORS.length]}
                      radius={i === weeklyVolume.sports.length - 1 ? [3, 3, 0, 0] : undefined} />
                  ))}
                </BarChart>
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
