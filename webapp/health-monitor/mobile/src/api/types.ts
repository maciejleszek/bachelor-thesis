export interface DailyMetric {
  date: string;
  source: "garmin" | "miband" | string;
  avg_hr?: number | null;
  max_hr?: number | null;
  resting_hr?: number | null;
  hrv?: number | null;
  spo2?: number | null;
  steps?: number | null;
  avg_stress?: number | null;
  max_stress?: number | null;
  sleep_total_min?: number | null;
  sleep_deep_min?: number | null;
  sleep_light_min?: number | null;
  sleep_rem_min?: number | null;
  sleep_score?: number | null;
}

export interface Survey {
  id: number;
  date: string;
  sam_valence?: number | null;
  sam_arousal?: number | null;
  sam_dominance?: number | null;
  vas_stress?: number | null;
  notes?: string | null;
  created_at?: string;
}

export interface BloodPressure {
  id: number;
  sys: number;
  dia: number;
  pulse?: number | null;
  notes?: string | null;
  measured_at?: string;
}

export interface Activity {
  id: number;
  source?: string;
  name?: string | null;
  sport_type: string;
  start_time: string;
  duration_sec?: number | null;
  distance_m?: number | null;
  calories?: number | null;
  avg_hr?: number | null;
  max_hr?: number | null;
  avg_speed_mps?: number | null;
  training_load?: number | null;
}

export interface Summary {
  metrics: DailyMetric[];
  surveys: Survey[];
  blood_pressure: BloodPressure[];
}

export interface CorrelationResult {
  pairs: Array<Record<string, number | string | null>>;
  correlations: Record<string, { r: number | null; n: number }>;
}
