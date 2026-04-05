function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["good", "normal", "healthy"].includes(normalized)) return "good";
  if (["deficiency", "deficient", "low"].includes(normalized)) return "deficiency";
  if (["superficiency", "surplus", "high", "excess"].includes(normalized)) return "superficiency";
  return "unknown";
}

function inferStatusFromHint(userName, fileName) {
  const combined = `${userName || ""} ${fileName || ""}`.toLowerCase();
  if (combined.includes("low") || combined.includes("def") || combined.includes("deficiency")) {
    return "deficiency";
  }
  if (combined.includes("high") || combined.includes("super") || combined.includes("excess")) {
    return "superficiency";
  }
  return "good";
}

function buildFollowUps(status) {
  if (status === "deficiency") {
    return [
      "Increase nutrient-dense foods and prescribed supplements.",
      "Stay consistent for 14 days and track symptoms.",
      "Re-test in 2 to 4 weeks as advised by your doctor.",
    ];
  }

  if (status === "superficiency") {
    return [
      "Reduce intake of the over-represented nutrient source.",
      "Hydrate well and monitor side effects daily.",
      "Repeat test after 1 to 2 weeks with clinical guidance.",
    ];
  }

  return [
    "Maintain your current routine and balanced diet.",
    "Schedule preventive re-check as per doctor recommendation.",
  ];
}

function buildSummary(status) {
  if (status === "deficiency") {
    return "Your report suggests a deficiency pattern. Follow the corrective plan and recheck soon.";
  }
  if (status === "superficiency") {
    return "Your report suggests elevated markers. Follow reduction guidance and monitor trends.";
  }
  return "Your report appears within normal range based on backend screening logic.";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const imageDataUrl = body.imageDataUrl;

  if (!imageDataUrl || typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "A valid imageDataUrl is required." });
  }

  // The backend can consume a client-sent statusHint or infer from metadata until OCR/LLM extraction is wired.
  const requestedStatus = normalizeStatus(body.statusHint);
  const status = requestedStatus === "unknown"
    ? inferStatusFromHint(body.userName, body.fileName)
    : requestedStatus;

  const followUps = buildFollowUps(status);
  const summary = buildSummary(status);

  return res.status(200).json({
    scanId: `scan_${Date.now()}`,
    status,
    summary,
    details: "Screening completed. For medical decisions, confirm with clinician-reviewed lab interpretation.",
    followUps,
    followUpMessage: followUps[0],
    nextCheckInDays: status === "good" ? 30 : 14,
  });
};
