import { useState } from "react";
import { api } from "../api";
import { useToast } from "../hooks/useToast";

function Field({ label, name, value, onChange, unit, type = "number", min, max, step = 1 }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="form-label" style={{ marginBottom: 4 }}>
        {label} {unit && <span style={{ color: "var(--muted)" }}>({unit})</span>}
      </div>
      <input
        type={type}
        name={name}
        value={value}
        min={min} max={max} step={step}
        onChange={onChange}
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          color: "var(--text)",
          fontFamily: "inherit",
          fontSize: "0.95rem",
          padding: "10px 12px",
          width: "100%",
          outline: "none",
        }}
        placeholder="—"
      />
    </div>
  );
}

const emptyMetrics = {
  date: new Date().toISOString().slice(0, 10),
  source: "miband",
  avg_hr: "", max_hr: "", resting_hr: "",
  hrv: "", spo2: "", steps: "",
  avg_stress: "", max_stress: "",
  sleep_total_min: "", sleep_deep_min: "",
  sleep_light_min: "", sleep_rem_min: "",
  sleep_score: "",
};

const emptyBP = { sys: "", dia: "", pulse: "", notes: "" };

function toNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function toInt(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

export default function Data() {
  const [metrics, setMetrics] = useState(emptyMetrics);
  const [bp, setBp] = useState(emptyBP);
  const [savingM, setSavingM] = useState(false);
  const [savingBP, setSavingBP] = useState(false);
  const { show, Toast } = useToast();

  function handleM(e) {
    setMetrics(p => ({ ...p, [e.target.name]: e.target.value }));
  }
  function handleBP(e) {
    setBp(p => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function submitMetrics(e) {
    e.preventDefault();
    setSavingM(true);
    try {
      await api.postMetrics({
        date: metrics.date,
        source: metrics.source,
        avg_hr:          toNum(metrics.avg_hr),
        max_hr:          toNum(metrics.max_hr),
        resting_hr:      toNum(metrics.resting_hr),
        hrv:             toNum(metrics.hrv),
        spo2:            toNum(metrics.spo2),
        steps:           toInt(metrics.steps),
        avg_stress:      toNum(metrics.avg_stress),
        max_stress:      toNum(metrics.max_stress),
        sleep_total_min: toInt(metrics.sleep_total_min),
        sleep_deep_min:  toInt(metrics.sleep_deep_min),
        sleep_light_min: toInt(metrics.sleep_light_min),
        sleep_rem_min:   toInt(metrics.sleep_rem_min),
        sleep_score:     toNum(metrics.sleep_score),
      });
      show("✓ Dane zapisane / zaktualizowane!");
    } catch {
      show("Błąd zapisu metryk", "error");
    } finally {
      setSavingM(false);
    }
  }

  async function submitBP(e) {
    e.preventDefault();
    if (!bp.sys || !bp.dia) { show("Podaj SYS i DIA", "error"); return; }
    setSavingBP(true);
    try {
      await api.postBloodPressure({
        sys:   toInt(bp.sys),
        dia:   toInt(bp.dia),
        pulse: toInt(bp.pulse) || null,
        notes: bp.notes || null,
      });
      show("✓ Ciśnienie zapisane!");
      setBp(emptyBP);
    } catch {
      show("Błąd zapisu ciśnienia", "error");
    } finally {
      setSavingBP(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">Wprowadź dane ⌚</div>

      {/* ── Metrics form ── */}
      <form onSubmit={submitMetrics}>
        <div className="card" style={{ marginBottom: "var(--gap)" }}>
          <div className="card-title">Dane z opaski / zegarka</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <Field label="Data" name="date" value={metrics.date} onChange={handleM}
                   type="date" />
            <div style={{ marginBottom: 12 }}>
              <div className="form-label" style={{ marginBottom: 4 }}>Źródło</div>
              <select
                name="source" value={metrics.source} onChange={handleM}
                style={{
                  background: "var(--surface2)", border: "1px solid var(--border)",
                  borderRadius: 8, color: "var(--text)", fontFamily: "inherit",
                  fontSize: "0.95rem", padding: "10px 12px", width: "100%",
                }}
              >
                <option value="miband">Mi Band 10</option>
                <option value="garmin">Garmin Fenix 7X</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0 14px", opacity: .4 }} />
          <div className="form-label" style={{ marginBottom: 10 }}>❤️ Tętno</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" }}>
            <Field label="Średnie" name="avg_hr"     value={metrics.avg_hr}     onChange={handleM} unit="bpm" />
            <Field label="Maks."   name="max_hr"     value={metrics.max_hr}     onChange={handleM} unit="bpm" />
            <Field label="Spocz."  name="resting_hr" value={metrics.resting_hr} onChange={handleM} unit="bpm" />
          </div>

          <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0 14px", opacity: .4 }} />
          <div className="form-label" style={{ marginBottom: 10 }}>💚 HRV / SpO₂ / Aktywność</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" }}>
            <Field label="HRV"   name="hrv"   value={metrics.hrv}   onChange={handleM} unit="ms" step={0.1} />
            <Field label="SpO₂"  name="spo2"  value={metrics.spo2}  onChange={handleM} unit="%"  step={0.1} />
            <Field label="Kroki" name="steps" value={metrics.steps} onChange={handleM} unit="" />
          </div>

          <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0 14px", opacity: .4 }} />
          <div className="form-label" style={{ marginBottom: 10 }}>😰 Stres</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <Field label="Średni" name="avg_stress" value={metrics.avg_stress} onChange={handleM} unit="/100" />
            <Field label="Maks."  name="max_stress" value={metrics.max_stress} onChange={handleM} unit="/100" />
          </div>

          <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0 14px", opacity: .4 }} />
          <div className="form-label" style={{ marginBottom: 10 }}>🌙 Sen</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <Field label="Łącznie"   name="sleep_total_min" value={metrics.sleep_total_min} onChange={handleM} unit="min" />
            <Field label="Głęboki"   name="sleep_deep_min"  value={metrics.sleep_deep_min}  onChange={handleM} unit="min" />
            <Field label="Płytki"    name="sleep_light_min" value={metrics.sleep_light_min} onChange={handleM} unit="min" />
            <Field label="REM"       name="sleep_rem_min"   value={metrics.sleep_rem_min}   onChange={handleM} unit="min" />
            <Field label="Sleep score" name="sleep_score"   value={metrics.sleep_score}     onChange={handleM} unit="/100" step={0.1} />
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={savingM}
                style={{ marginBottom: "var(--gap)" }}>
          {savingM ? "Zapisuję…" : "Zapisz dane opaski"}
        </button>
      </form>

      {/* ── Blood pressure form ── */}
      <form onSubmit={submitBP}>
        <div className="card" style={{ marginBottom: "var(--gap)" }}>
          <div className="card-title">🩺 Ciśnienie krwi</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" }}>
            <Field label="SYS" name="sys"   value={bp.sys}   onChange={handleBP} unit="mmHg" />
            <Field label="DIA" name="dia"   value={bp.dia}   onChange={handleBP} unit="mmHg" />
            <Field label="Puls" name="pulse" value={bp.pulse} onChange={handleBP} unit="bpm" />
          </div>
          <div className="form-label" style={{ marginBottom: 4 }}>Notatka</div>
          <input type="text" name="notes" value={bp.notes}
                 onChange={handleBP} placeholder="np. po kawie, rano" />
        </div>
        <button className="btn btn-success" type="submit" disabled={savingBP}>
          {savingBP ? "Zapisuję…" : "Zapisz ciśnienie"}
        </button>
      </form>

      {Toast}
    </div>
  );
}
