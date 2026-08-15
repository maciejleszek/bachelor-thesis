import { useEffect, useState } from "react";
import { api } from "../api";
import { useInterval } from "../hooks/useInterval";

const REFRESH_MS = 60 * 1000;

const LABELS = {
  garmin_metrics: "Garmin",
  garmin_activities: "Aktywności",
  miband: "Mi Band",
};

function relativeTime(iso) {
  if (!iso) return null;
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "przed chwilą";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h temu`;
  const diffD = Math.round(diffH / 24);
  return `${diffD} dni temu`;
}

export default function SyncStatus() {
  const [status, setStatus] = useState(null);

  function load() {
    return api.getSyncStatus().then(setStatus).catch(() => {});
  }

  useEffect(() => { load(); }, []);
  useInterval(load, REFRESH_MS);

  if (!status) return null;

  const entries = Object.entries(LABELS)
    .map(([key, label]) => ({ key, label, info: status[key] }))
    .filter(({ info }) => info);

  if (entries.length === 0) return null;

  return (
    <div
      style={{
        position: "sticky", top: 0, zIndex: 90,
        display: "flex", flexWrap: "wrap", gap: "4px 14px",
        padding: "6px 16px", fontSize: "0.72rem", color: "var(--muted)",
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
      }}
    >
      {entries.map(({ key, label, info }) => {
        const failed = info.last_error && (!info.last_success_at ||
          new Date(info.last_attempt_at) > new Date(info.last_success_at));
        const time = relativeTime(info.last_success_at);
        return (
          <span key={key} title={failed ? info.last_error : undefined}
                style={{ color: failed ? "var(--danger)" : "var(--muted)" }}>
            {label}: {time ?? "brak danych"}{failed ? " ⚠️" : ""}
          </span>
        );
      })}
    </div>
  );
}
