import { useState } from "react";
import { api } from "../api";
import { useToast } from "../hooks/useToast";

// SAM scale definitions
const SAM_VALENCE = [
  { v: 0, emoji: "😭", label: "Bardzo źle" },
  { v: 1, emoji: "😢", label: "" },
  { v: 2, emoji: "😞", label: "" },
  { v: 3, emoji: "😕", label: "" },
  { v: 4, emoji: "😐", label: "Neutral" },
  { v: 5, emoji: "🙂", label: "" },
  { v: 6, emoji: "😊", label: "" },
  { v: 7, emoji: "😄", label: "" },
  { v: 8, emoji: "😁", label: "" },
  { v: 9, emoji: "🤩", label: "Bardzo dobrze" },
];

const SAM_AROUSAL = [
  { v: 0, emoji: "😴", label: "Bardzo spokojny" },
  { v: 1, emoji: "🥱", label: "" },
  { v: 2, emoji: "😌", label: "" },
  { v: 3, emoji: "🧘", label: "" },
  { v: 4, emoji: "😶", label: "Neutral" },
  { v: 5, emoji: "🙄", label: "" },
  { v: 6, emoji: "🤔", label: "" },
  { v: 7, emoji: "😬", label: "" },
  { v: 8, emoji: "😤", label: "" },
  { v: 9, emoji: "🤯", label: "Bardzo pobudzony" },
];

const SAM_DOMINANCE = [
  { v: 0, emoji: "🫥", label: "Brak kontroli" },
  { v: 2, emoji: "😓", label: "" },
  { v: 4, emoji: "😐", label: "Neutral" },
  { v: 6, emoji: "😌", label: "" },
  { v: 8, emoji: "💪", label: "" },
  { v: 9, emoji: "🦁", label: "Pełna kontrola" },
];

function SamPicker({ label, items, value, onChange }) {
  return (
    <div className="form-group">
      <div className="form-label">{label}</div>
      <div className="sam-row">
        {items.map(({ v, emoji, label: l }) => (
          <button
            key={v}
            type="button"
            className={"sam-btn" + (value === v ? " selected" : "")}
            onClick={() => onChange(v)}
            title={l || String(v)}
          >
            <span className="emoji">{emoji}</span>
            <span className="sam-num">{v}</span>
          </button>
        ))}
      </div>
      {value != null && (
        <div className="form-hint">
          Wybrano: <strong>{value}</strong>
          {items.find(i => i.v === value)?.label
            ? ` — ${items.find(i => i.v === value).label}` : ""}
        </div>
      )}
    </div>
  );
}

function VasPicker({ label, hint, value, onChange, leftLabel = "Brak", rightLabel = "Maksymalny" }) {
  return (
    <div className="form-group">
      <div className="form-label">{label}</div>
      {hint && <div className="form-hint">{hint}</div>}
      <div className="slider-wrap">
        <div className="vas-value">{value}</div>
        <input
          className="slider"
          type="range"
          min={0} max={100} step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
        />
        <div className="slider-labels">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}

export default function Survey() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [samValence, setSamValence]   = useState(null);
  const [samArousal, setSamArousal]   = useState(null);
  const [samDominance, setSamDominance] = useState(null);
  const [vasStress, setVasStress] = useState(50);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { show, Toast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    if (samValence == null || samArousal == null || samDominance == null) {
      show("Wypełnij wszystkie skale SAM", "error");
      return;
    }
    setSaving(true);
    try {
      await api.postSurvey({
        date,
        sam_valence: samValence,
        sam_arousal: samArousal,
        sam_dominance: samDominance,
        vas_stress: vasStress,
        notes: notes || null,
      });
      show("✓ Ankieta zapisana!");
      setSamValence(null);
      setSamArousal(null);
      setSamDominance(null);
      setVasStress(50);
      setNotes("");
    } catch {
      show("Błąd zapisu — sprawdź połączenie", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">Ankieta SAM + VAS 📝</div>

      <form onSubmit={handleSubmit}>

        {/* Date */}
        <div className="form-group">
          <div className="form-label">Data</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="card" style={{ marginBottom: "var(--gap)" }}>
          <div className="card-title">SAM — Self-Assessment Manikin</div>

          <SamPicker
            label="Walencja — jak się czujesz? (nastrój)"
            items={SAM_VALENCE}
            value={samValence}
            onChange={setSamValence}
          />
          <SamPicker
            label="Pobudzenie — jak bardzo aktywny/pobudzony?"
            items={SAM_AROUSAL}
            value={samArousal}
            onChange={setSamArousal}
          />
          <SamPicker
            label="Dominacja — jak bardzo masz kontrolę?"
            items={SAM_DOMINANCE}
            value={samDominance}
            onChange={setSamDominance}
          />
        </div>

        <div className="card" style={{ marginBottom: "var(--gap)" }}>
          <div className="card-title">VAS — Visual Analogue Scale</div>
          <VasPicker
            label="Poziom stresu (0–100)"
            hint="0 = całkowity spokój, 100 = skrajny stres"
            value={vasStress}
            onChange={setVasStress}
            leftLabel="Spokój 😌"
            rightLabel="Stres 😰"
          />
        </div>

        {/* Notes */}
        <div className="form-group">
          <div className="form-label">Notatka (opcjonalnie)</div>
          <textarea
            placeholder="Co się działo dzisiaj?"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Zapisuję…" : "Zapisz ankietę"}
        </button>
      </form>

      {Toast}
    </div>
  );
}
