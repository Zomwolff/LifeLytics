function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["good", "normal", "healthy"].includes(normalized)) return "good";
  if (["deficiency", "deficient", "low"].includes(normalized)) return "deficiency";
  if (["superficiency", "surplus", "high", "excess"].includes(normalized)) return "superficiency";
  return "unknown";
}

function statusStepDown(currentStatus, followUpCount) {
  if (currentStatus === "good") return "good";

  // Simulate iterative follow-up improvement; move to good after a few cycles.
  if (followUpCount >= 2) return "good";

  return currentStatus;
}

function messageFor(status, cycle) {
  if (status === "good") {
    return "Latest follow-up indicates values are back to normal. Continue maintenance and periodic checks.";
  }

  if (status === "deficiency") {
    if (cycle === 0) return "Keep supplement schedule strict and include iron/protein-rich meals daily.";
    if (cycle === 1) return "Symptoms should improve gradually; continue plan and repeat labs on schedule.";
    return "Continue correction plan and monitor until your next lab confirms normalization.";
  }

  if (status === "superficiency") {
    if (cycle === 0) return "Limit excess intake sources and maintain hydration targets each day.";
    if (cycle === 1) return "Avoid self-adjusting doses without clinician guidance; retest after this cycle.";
    return "Continue moderation plan and observe trend stabilization.";
  }

  return "Follow-up generated. Continue your doctor-advised plan and monitor changes.";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const currentStatus = normalizeStatus(body.currentStatus);
  if (currentStatus === "unknown") {
    return res.status(400).json({ error: "currentStatus is required and must be valid." });
  }

  const followUpHistory = Array.isArray(body.followUpHistory) ? body.followUpHistory : [];
  const nextStatus = statusStepDown(currentStatus, followUpHistory.length);
  const followUpMessage = messageFor(nextStatus, followUpHistory.length);

  return res.status(200).json({
    scanId: body.scanId || null,
    status: nextStatus,
    summary: nextStatus === "good"
      ? "Progress check complete. Report trend now appears normal."
      : "Progress check complete. Continue follow-up plan until normal.",
    details: "Automated follow-up generated from previous status history.",
    followUpMessage,
    nextCheckInDays: nextStatus === "good" ? 30 : 7,
  });
};
