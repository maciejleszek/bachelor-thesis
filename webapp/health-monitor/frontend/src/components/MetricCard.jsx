export default function MetricCard({ icon, label, value, unit, sub, color }) {
  return (
    <div className="metric-card" style={color ? { borderLeftColor: color, borderLeftWidth: 3 } : {}}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value ?? <span style={{ color: "var(--muted)", fontSize: "1.1rem" }}>—</span>}
        {value != null && <span className="metric-unit"> {unit}</span>}
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
