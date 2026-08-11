const BASE = process.env.REACT_APP_API || "/api";

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getSummary: ()           => request("/summary"),
  getMetrics: (p)          => request("/metrics?" + new URLSearchParams(p)),
  postMetrics: (body)      => request("/metrics", { method: "POST", body: JSON.stringify(body) }),
  getSurveys: (limit = 60) => request(`/surveys?limit=${limit}`),
  postSurvey: (body)       => request("/surveys", { method: "POST", body: JSON.stringify(body) }),
  deleteSurvey: (id)       => request(`/surveys/${id}`, { method: "DELETE" }),
  getBloodPressure: ()     => request("/blood-pressure"),
  postBloodPressure: (b)   => request("/blood-pressure", { method: "POST", body: JSON.stringify(b) }),
  getActivities: (p = {})  => request("/activities?" + new URLSearchParams(p)),
  getSportTypes: ()        => request("/activities/sport-types"),
  getActivitySummary: (p = {}) => request("/activities/summary?" + new URLSearchParams(p)),
  getActivityDetails: (id)     => request(`/activities/${id}/details`),
  getCorrelation: (p = {})     => request("/analysis/correlation?" + new URLSearchParams(p)),
};
