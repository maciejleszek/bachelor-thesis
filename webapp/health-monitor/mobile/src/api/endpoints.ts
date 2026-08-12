import { http } from "./client";
import type {
  Activity,
  BloodPressure,
  CorrelationResult,
  DailyMetric,
  Summary,
  Survey,
} from "./types";

const { request, qs } = http;

export const api = {
  getSummary: () => request<Summary>("/summary"),

  getMetrics: (params: { source?: string; days?: number } = {}) =>
    request<DailyMetric[]>(`/metrics${qs(params)}`),
  postMetrics: (body: DailyMetric) =>
    request<{ id: number }>("/metrics", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getSurveys: (limit = 30) => request<Survey[]>(`/surveys${qs({ limit })}`),
  postSurvey: (body: Partial<Survey>) =>
    request<{ id: number }>("/surveys", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteSurvey: (id: number) =>
    request<null>(`/surveys/${id}`, { method: "DELETE" }),

  getBloodPressure: (days = 30) =>
    request<BloodPressure[]>(`/blood-pressure${qs({ days })}`),
  postBloodPressure: (body: Partial<BloodPressure>) =>
    request<{ id: number }>("/blood-pressure", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getActivities: (params: { sport_type?: string; days?: number; limit?: number } = {}) =>
    request<Activity[]>(`/activities${qs(params)}`),
  getSportTypes: () => request<string[]>("/activities/sport-types"),
  getActivitySummary: (params: { days?: number } = {}) =>
    request<{ by_sport: unknown[]; weekly: unknown[] }>(`/activities/summary${qs(params)}`),

  getCorrelation: (params: { days?: number } = {}) =>
    request<CorrelationResult>(`/analysis/correlation${qs(params)}`),

  health: () => request<{ status: string }>("/health"),
};
