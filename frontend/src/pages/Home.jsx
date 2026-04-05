import { apiFetch } from "../api/client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function Home({ user, goHome, goChat, goMetrics, goTrends, goProfile, goAi, onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [selectedPrescriptionFile, setSelectedPrescriptionFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isScanningPrescription, setIsScanningPrescription] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [followUpHistory, setFollowUpHistory] = useState([]);
  const [isFetchingFollowUp, setIsFetchingFollowUp] = useState(false);
  const uploadInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const bmi = Number.isFinite(user?.heightCm) && Number.isFinite(user?.weightKg)
    ? user.weightKg / ((user.heightCm / 100) * (user.heightCm / 100))
    : null;
  const bmiProgress = bmi ? Math.min(Math.max(bmi / 40, 0), 1) : 0;
  const bmiArcColor = !bmi ? "#7ebeff" : bmi < 18.5 ? "#7ebeff" : bmi <= 24.9 ? "#6de1a7" : bmi <= 29.9 ? "#f6c96f" : "#f08a8a";
  const bmiCategory = !bmi ? "No data" : bmi < 18.5 ? "Underweight" : bmi <= 24.9 ? "Normal" : bmi <= 29.9 ? "Overweight" : "Obese";

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read image file."));
      reader.readAsDataURL(file);
    });
  }

  function handlePrescriptionFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setScanError("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setSelectedPrescriptionFile(file);
    setPreviewUrl(nextPreviewUrl);
    setScanResult(null);
    setFollowUpHistory([]);
    setScanError("");
    event.target.value = "";
  }

  function normalizeReportStatus(rawStatus) {
    const normalized = String(rawStatus || "").trim().toLowerCase();
    if (["good", "normal", "healthy"].includes(normalized)) return "good";
    if (["deficiency", "deficient", "low"].includes(normalized)) return "deficiency";
    if (["superficiency", "surplus", "high", "excess"].includes(normalized)) return "superficiency";
    return "unknown";
  }

  function statusLabel(status) {
    if (status === "good") return "Good";
    if (status === "deficiency") return "Deficiency";
    if (status === "superficiency") return "Superficiency";
    return "Pending Review";
  }

  function statusStyles(status) {
    if (status === "good") {
      return "border-[#8ad8b2] bg-[#ecfbf3] text-[#0f6c46]";
    }
    if (status === "deficiency") {
      return "border-[#f1c07e] bg-[#fff7ea] text-[#8b5605]";
    }
    if (status === "superficiency") {
      return "border-[#f2a3a3] bg-[#fff0f0] text-[#8f2b2b]";
    }
    return "border-[#b5c3d8] bg-[#f2f6fc] text-[#324864]";
  }

  async function handleScanPrescription() {
    if (!selectedPrescriptionFile) {
      setScanError("Upload or take a photo before scanning.");
      return;
    }

    setIsScanningPrescription(true);
    setScanError("");

    try {
      const imageDataUrl = await fileToDataUrl(selectedPrescriptionFile);

      const form = new FormData();
      form.append("file", selectedPrescriptionFile);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/upload/report`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const normalizedStatus = normalizeReportStatus(data.status);
      const followUpItems = Array.isArray(data.followUps)
        ? data.followUps
        : data.followUpMessage
          ? [data.followUpMessage]
          : [];

      setScanResult({
        scanId: data.scanId || null,
        status: normalizedStatus,
        summary: data.summary || "Scan complete.",
        details: data.details || data.findings || "",
        nextCheckIn: data.nextCheckIn || data.nextCheckInDays || null,
      });
      setFollowUpHistory(followUpItems);
    } catch {
      setScanError("Unable to scan right now. Connect backend endpoint to process report images.");
    } finally {
      setIsScanningPrescription(false);
    }
  }

  async function handleFollowUp() {
    if (!scanResult) return;

    setIsFetchingFollowUp(true);
    setScanError("");

    try {
      const data = await apiFetch("/upload/follow-up", {
        method: "POST",
        body: JSON.stringify({
          scanId: scanResult.scanId,
          currentStatus: scanResult.status,
          followUpHistory,
        }),
      });
      const normalizedStatus = normalizeReportStatus(data.status || scanResult.status);
      const nextMessage = data.followUpMessage || "Continue the plan and recheck after your next cycle.";

      setFollowUpHistory((prev) => [...prev, nextMessage]);
      setScanResult((prev) => (
        prev
          ? {
              ...prev,
              status: normalizedStatus,
              summary: data.summary || prev.summary,
              details: data.details || prev.details,
              nextCheckIn: data.nextCheckIn || data.nextCheckInDays || prev.nextCheckIn,
            }
          : prev
      ));
    } catch {
      setScanError("Unable to fetch follow-up right now.");
    } finally {
      setIsFetchingFollowUp(false);
    }
  }

  function closePrescriptionModal() {
    setIsPrescriptionModalOpen(false);
    setScanError("");
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-4 py-6 md:px-8 lg:px-10"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#71bcff_0%,rgba(113,188,255,0.32)_56%,transparent_100%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#69dcb0_0%,rgba(105,220,176,0.28)_56%,transparent_100%)] blur-2xl" />

      <motion.div
        className="pointer-events-none absolute left-1/2 top-16 h-24 w-[82%] max-w-[460px] -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(31,43,64,0),rgba(31,43,64,0.22),rgba(31,43,64,0))] blur-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.45 }}
        transition={{ duration: 1.1 }}
      />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1100px] flex-col"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="mb-4 flex items-center justify-between">
          <div className="relative">
            <button
              type="button"
              aria-label="Open profile menu"
              onClick={() => {
                setIsMenuOpen(false);
                setIsProfileMenuOpen((prev) => !prev);
              }}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/60 bg-[rgba(255,255,255,0.72)] text-[#1f3150] shadow-[0_8px_20px_rgba(31,43,64,0.16)]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 19c1.3-3.2 3.7-5 7-5s5.7 1.8 7 5" />
              </svg>
            </button>

            {isProfileMenuOpen ? (
              <div className="absolute left-0 top-12 z-20 w-36 overflow-hidden rounded-xl border border-[#a3b3cb] bg-[rgba(255,255,255,0.95)] shadow-[0_10px_22px_rgba(31,43,64,0.2)]">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    goProfile();
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-semibold text-[#20314a] hover:bg-[#eef3fb]"
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full border-t border-[#d0d9e8] px-3 py-2 text-left text-sm font-semibold text-[#9e2f2f] hover:bg-[#fff1f1]"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="grid h-10 w-10 place-items-center rounded-full border border-[#8ea2bf] bg-[rgba(255,255,255,0.68)] text-[#23334d] shadow-[0_8px_18px_rgba(31,43,64,0.15)]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </button>

            {isMenuOpen ? (
              <div className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-xl border border-[#a3b3cb] bg-[rgba(255,255,255,0.95)] shadow-[0_10px_22px_rgba(31,43,64,0.2)]">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsProfileMenuOpen(false);
                    goHome();
                  }}
                  className="w-full px-3 py-2 text-left text-sm font-semibold text-[#20314a] hover:bg-[#eef3fb]"
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsProfileMenuOpen(false);
                    goMetrics();
                  }}
                  className="w-full border-t border-[#d0d9e8] px-3 py-2 text-left text-sm font-semibold text-[#20314a] hover:bg-[#eef3fb]"
                >
                  Metrics
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsProfileMenuOpen(false);
                    goTrends();
                  }}
                  className="w-full border-t border-[#d0d9e8] px-3 py-2 text-left text-sm font-semibold text-[#20314a] hover:bg-[#eef3fb]"
                >
                  Trends
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsProfileMenuOpen(false);
                    goChat();
                  }}
                  className="w-full border-t border-[#d0d9e8] px-3 py-2 text-left text-sm font-semibold text-[#20314a] hover:bg-[#eef3fb]"
                >
                  Chatbot
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <div className="mb-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#3b4f6d]">Dashboard</p>
          <p
            className="mt-1 text-[1.5rem] font-semibold leading-[1.08] text-[#131722]"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            {user?.name ? `Welcome, ${user.name}` : "Welcome"}
          </p>
        </div>

        <main className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            type="button"
            onClick={goMetrics}
            className="row-span-2 min-h-[222px] rounded-[1.5rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 pb-4 pt-6 text-left text-white shadow-[0_12px_26px_rgba(17,29,46,0.28)] md:col-span-2 md:min-h-[300px]"
          >
            <div className="mb-5 grid place-items-center">
              <svg viewBox="0 0 120 70" className="h-16 w-full max-w-[176px]" fill="none" aria-hidden="true">
                <path
                  d="M12 56a48 48 0 0 1 96 0"
                  stroke="rgba(158,207,255,0.35)"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <path
                  d="M12 56a48 48 0 0 1 96 0"
                  strokeWidth="7"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={`${(bmiProgress * 100).toFixed(1)} 100`}
                  stroke={bmiArcColor}
                />
              </svg>
            </div>
            <p
              className="-mt-9 mb-6 text-center text-[3rem] font-bold tracking-[-0.02em]"
              style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
            >
              {bmi ? bmi.toFixed(1) : "--"}
            </p>
            <p className="-mt-5 mb-5 text-center text-[0.8rem] font-semibold uppercase tracking-[0.12em] text-[#c3daf7]">
              {bmiCategory}
            </p>
            <div className="space-y-1 text-[0.98rem] font-semibold leading-tight text-[#e8efff]">
              <p>Height : {Number.isFinite(user?.heightCm) ? `${user.heightCm} cm` : "-"}</p>
              <p>Weight : {Number.isFinite(user?.weightKg) ? `${user.weightKg} kg` : "-"}</p>
              <p>BMI : {bmi ? bmi.toFixed(1) : "-"}</p>
            </div>
          </button>

          <button
            type="button"
            onClick={goAi}
            className="min-h-[104px] rounded-[1.25rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 py-3 text-left text-white shadow-[0_12px_22px_rgba(17,29,46,0.26)]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a6 6 0 0 0-3.8 10.7c1 .8 1.8 2 1.8 3.3h4c0-1.3.8-2.5 1.8-3.3A6 6 0 0 0 12 2z" />
              <path d="M9.5 19h5" />
              <path d="M10.4 22h3.2" />
            </svg>
            <p
              className="mt-1 text-[1.75rem] font-bold leading-[1.03] tracking-[-0.01em]"
              style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
            >
              AI
            </p>
            <p
              className="text-[1.75rem] font-bold leading-[1.03] tracking-[-0.01em]"
              style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
            >
              Insights
            </p>
          </button>

          <button
            type="button"
            onClick={goTrends}
            className="min-h-[104px] rounded-[1.25rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 py-3 text-left text-white shadow-[0_12px_22px_rgba(17,29,46,0.26)]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 17l6-6 4 4 7-7" />
              <path d="M14 8h6v6" />
            </svg>
            <p
              className="mt-2 text-[1.75rem] font-bold leading-[1.04] tracking-[-0.01em]"
              style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
            >
              Trends
            </p>
          </button>

          <button
            type="button"
            onClick={() => setIsPrescriptionModalOpen(true)}
            className="col-span-2 min-h-[106px] rounded-[1.35rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 py-3 text-left text-white shadow-[0_12px_22px_rgba(17,29,46,0.26)] md:col-span-4"
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M8 7l1.3-2h5.4L16 7" />
              <circle cx="12" cy="13.5" r="3.2" />
            </svg>
            <p
              className="mt-1 text-[1.7rem] font-bold leading-[1.02] tracking-[-0.01em]"
              style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
            >
              Prescription Insights
            </p>
          </button>
        </main>

        <div className="mt-auto md:mx-auto md:w-full md:max-w-[760px]">
          <button
            type="button"
            onClick={goChat}
            className="w-full rounded-[1rem] border border-[#a3b3cb] bg-[rgba(255,255,255,0.56)] px-3 py-2 text-left shadow-[0_8px_20px_rgba(31,43,64,0.14)] backdrop-blur-[2px]"
          >
            <div className="flex items-center gap-2 text-[#3a4c68]">
              <span className="grid h-9 w-9 place-items-center rounded-[0.6rem] border border-[#6a7f9f] text-3xl leading-none text-[#21314a]">
                +
              </span>
              <input
                readOnly
                onFocus={goChat}
                placeholder="Ask LifeLytics assistant..."
                className="h-9 w-full cursor-text rounded-[0.7rem] border border-[#b7c5d9] bg-[rgba(255,255,255,0.65)] px-3 text-sm font-medium text-[#1a2b43] outline-none placeholder:text-[#667a98]"
              />
              <span className="grid h-9 w-9 place-items-center rounded-[0.6rem] border border-[#6a7f9f] text-[#21314a]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h13" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </button>
        </div>
      </motion.div>

      {isPrescriptionModalOpen ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[rgba(10,20,34,0.56)] px-4">
          <div className="w-full max-w-[760px] rounded-[1.4rem] border border-[#c3d1e3] bg-[linear-gradient(160deg,#f7fbff,#e7f0fb)] p-4 shadow-[0_20px_44px_rgba(7,19,36,0.35)]">
            <div className="mb-3 flex items-center justify-between">
              <p
                className="text-[1.08rem] font-bold text-[#16233a]"
                style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
              >
                Prescription Scan
              </p>
              <button
                type="button"
                onClick={closePrescriptionModal}
                className="rounded-full border border-[#9db0c9] bg-white/80 px-2 py-1 text-xs font-semibold text-[#29405e]"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="rounded-xl border border-[#adbdd4] bg-white/80 px-3 py-2 text-sm font-semibold text-[#223752]"
              >
                Upload Photo
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="rounded-xl border border-[#adbdd4] bg-white/80 px-3 py-2 text-sm font-semibold text-[#223752]"
              >
                Take Photo
              </button>
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              onChange={handlePrescriptionFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePrescriptionFileChange}
              className="hidden"
            />

            <div className="mt-3 min-h-[120px] rounded-xl border border-[#bccbdd] bg-white/70 p-2">
              {previewUrl ? (
                <img src={previewUrl} alt="Selected report" className="h-32 w-full rounded-lg object-cover md:h-44" />
              ) : (
                <p className="pt-10 text-center text-xs font-medium text-[#4e6486]">Upload or capture a report image to begin scanning.</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleScanPrescription}
              disabled={isScanningPrescription}
              className="mt-3 w-full rounded-xl border border-[#25466e] bg-[linear-gradient(145deg,#21456e,#1a3557)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isScanningPrescription ? "Scanning..." : "Scan And Check"}
            </button>

            {scanError ? <p className="mt-2 text-xs font-semibold text-[#8f2b2b]">{scanError}</p> : null}

            {scanResult ? (
              <div className="mt-3 rounded-xl border border-[#b9c9dd] bg-white/82 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#466086]">Report Status</p>
                  <span className={`rounded-full border px-2 py-1 text-xs font-bold ${statusStyles(scanResult.status)}`}>
                    {statusLabel(scanResult.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#1f3049]">{scanResult.summary}</p>
                {scanResult.details ? <p className="mt-1 text-xs leading-relaxed text-[#355172]">{scanResult.details}</p> : null}
                {scanResult.nextCheckIn ? (
                  <p className="mt-2 text-xs font-semibold text-[#355172]">Next follow-up: {String(scanResult.nextCheckIn)}</p>
                ) : null}

                {followUpHistory.length ? (
                  <div className="mt-2 rounded-lg border border-[#c5d3e5] bg-[#f3f7fd] px-2 py-2">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#4e6486]">Follow-up Plan</p>
                    <ul className="mt-1 space-y-1 text-xs text-[#2a4466]">
                      {followUpHistory.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {scanResult.status !== "good" ? (
                  <button
                    type="button"
                    onClick={handleFollowUp}
                    disabled={isFetchingFollowUp}
                    className="mt-3 w-full rounded-lg border border-[#728db0] bg-white px-2 py-2 text-xs font-semibold text-[#203652] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isFetchingFollowUp ? "Checking Follow-up..." : "Get Follow-up Until Normal"}
                  </button>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-[#0f6c46]">Your reports look normal. Continue maintenance checks.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
