import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../hooks/useToast";

const SAM_VALENCE_EMOJI = ["😭","😢","😞","😕","😐","🙂","😊","😄","😁","🤩"];
const SAM_AROUSAL_EMOJI = ["😴","🥱","😌","🧘","😶","🙄","🤔","😬","😤","🤯"];
const SAM_DOM_EMOJI     = ["🫥","","😓","","😐","","😌","","💪","🦁"];

function stressColor(v) {
  if (v == null) return "var(--muted)";
  if (v < 30)   return "var(--accent2)";
  if (v < 60)   return "var(--warn)";
  return "var(--danger)";
}

export default function History() {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const { show, Toast } = useToast();

  async function load() {
    try {
      const data = await api.getSurveys(60);
      setSurveys(data);
    } catch {
      show("Błąd ładowania danych", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!window.confirm("Usunąć tę ankietę?")) return;
    try {
      await api.deleteSurvey(id);
      setSurveys(prev => prev.filter(s => s.id !== id));
      show("Usunięto");
    } catch {
      show("Błąd usuwania", "error");
    }
  }

  if (loading) return <div className="empty">Ładowanie…</div>;

  return (
    <div className="page">
      <div className="page-title">Historia ankiet 📅</div>

      {surveys.length === 0 ? (
        <div className="empty">Brak ankiet.<br />Wypełnij pierwszą w zakładce Ankieta.</div>
      ) : (
        <div className="card">
          {surveys.map(s => (
            <div className="survey-item" key={s.id}>
              <div>
                <div className="survey-date">{s.date}</div>
                <button
                  onClick={() => handleDelete(s.id)}
                  style={{ marginTop: 6, background: "none", border: "none",
                           cursor: "pointer", color: "var(--danger)", fontSize: "0.75rem" }}
                >
                  🗑 Usuń
                </button>
              </div>
              <div>
                <div className="survey-pills">
                  {s.sam_valence != null && (
                    <span className="pill">
                      {SAM_VALENCE_EMOJI[s.sam_valence]} Nastrój {s.sam_valence}/9
                    </span>
                  )}
                  {s.sam_arousal != null && (
                    <span className="pill">
                      {SAM_AROUSAL_EMOJI[s.sam_arousal]} Pobudzenie {s.sam_arousal}/9
                    </span>
                  )}
                  {s.sam_dominance != null && (
                    <span className="pill">
                      {SAM_DOM_EMOJI[s.sam_dominance] || "🎯"} Kontrola {s.sam_dominance}/9
                    </span>
                  )}
                  {s.vas_stress != null && (
                    <span className="pill" style={{ color: stressColor(s.vas_stress) }}>
                      😰 Stres {s.vas_stress}/100
                    </span>
                  )}
                </div>
                {s.notes && (
                  <div style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--muted)" }}>
                    {s.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {Toast}
    </div>
  );
}
