function sanitizeSeries(series, fallback) {
  if (!Array.isArray(series) || series.length !== 7) return fallback;
  const parsed = series.map((value) => Number(value));
  return parsed.every((value) => Number.isFinite(value)) ? parsed : fallback;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};

  // Placeholder backend response shape; replace with DB-driven values when available.
  const fallbackPayload = {
    weeklySleep: [6.5, 7.1, 6.8, 7.4, 7.0, 8.0, 7.6],
    weeklySteps: [6100, 7400, 6900, 8200, 9100, 10200, 8800],
    weeklyCaloriesBurnt: [360, 420, 390, 470, 530, 580, 505],
    weeklyBloodGlucose: [102, 110, 106, 98, 104, 100, 96],
  };

  // Supports optional pre-computed trends from an upstream service.
  const trends = body.trends || {};

  return res.status(200).json({
    userId: body.userId || null,
    weeklySleep: sanitizeSeries(trends.weeklySleep, fallbackPayload.weeklySleep),
    weeklySteps: sanitizeSeries(trends.weeklySteps, fallbackPayload.weeklySteps),
    weeklyCaloriesBurnt: sanitizeSeries(trends.weeklyCaloriesBurnt, fallbackPayload.weeklyCaloriesBurnt),
    weeklyBloodGlucose: sanitizeSeries(trends.weeklyBloodGlucose, fallbackPayload.weeklyBloodGlucose),
    generatedAt: new Date().toISOString(),
  });
};
