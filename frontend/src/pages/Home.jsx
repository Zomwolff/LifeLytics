import { apiFetch } from "../api/client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const DEFAULT_INTAKE = {
  calories: 0,
  totalCalories: 0,
  steps: 0,
  stepsTarget: 10000,
  protein: 0,
  carbs: 0,
  fats: 0,
  caloriesBurnt: 0,
};

function getIndiaDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatPercent(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function MiniProgressCard({ title, value, target, progress, color, subtitle, valueSuffix = "" }) {
  const strokeLength = `${(progress * 100).toFixed(1)} 100`;

  return (
    <div className="rounded-[1.35rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 py-3 text-white shadow-[0_12px_22px_rgba(17,29,46,0.26)]">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#a7c1e4]">{title}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative grid h-16 w-16 place-items-center rounded-full bg-white/5">
          <svg viewBox="0 0 100 100" className="h-16 w-16" fill="none" aria-hidden="true">
            <circle cx="50" cy="50" r="36" stroke="rgba(158,207,255,0.18)" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="36"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray={strokeLength}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="pointer-events-none absolute text-[0.78rem] font-bold text-white">{value}</div>
        </div>
        <div>
          <p className="text-[1.15rem] font-bold leading-none">{value}{valueSuffix}</p>
          <p className="mt-1 text-[0.78rem] text-[#d6e4f8]">{subtitle}</p>
          {target && <p className="mt-1 text-[0.78rem] font-semibold text-[#a7c1e4]">Target {target}</p>}
        </div>
      </div>
    </div>
  );
}

function IntakeRing({ intake }) {
  const proteinKcal = intake.protein * 4;
  const carbKcal = intake.carbs * 4;
  const fatKcal = intake.fats * 9;
  const total = proteinKcal + carbKcal + fatKcal;

  return (
    <div className="rounded-[1.2rem] border border-[#d2dcec] bg-white/80 px-4 py-4 shadow-[0_8px_18px_rgba(31,43,64,0.08)]">
      <p className="text-center text-[0.85rem] font-bold uppercase tracking-[0.16em] text-[#58739a]">Calories</p>
      <div className="mx-auto mt-4 grid h-48 w-48 place-items-center rounded-full bg-[conic-gradient(#4f91f2_0_20.5%,#5ed1a6_20.5%_65.9%,#f4a164_65.9%_100%)] p-5">
        <div className="grid h-full w-full place-items-center rounded-full bg-[#f7f9fe] text-center text-[#22334f] shadow-inner">
          <div>
            <p className="text-[2rem] font-bold leading-none">{intake.totalCalories.toLocaleString()}</p>
            <p className="mt-2 text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#6b7f99]">kcal</p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[0.8rem] font-semibold uppercase tracking-[0.16em] text-[#58739a]">Total Calorie Intake</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[0.72rem] font-semibold text-[#29405e]">
        <div className="rounded-[0.9rem] border border-[#d3ddef] bg-[#f5f8fd] px-2 py-2 text-center">
          <p className="text-[#58739a]">Protein</p>
          <p className="mt-1 text-base text-[#20314a]">{formatPercent(proteinKcal, total)}</p>
        </div>
        <div className="rounded-[0.9rem] border border-[#d3ddef] bg-[#eefbf3] px-2 py-2 text-center">
          <p className="text-[#58739a]">Carbs</p>
          <p className="mt-1 text-base text-[#20314a]">{formatPercent(carbKcal, total)}</p>
        </div>
        <div className="rounded-[0.9rem] border border-[#d3ddef] bg-[#fff2e7] px-2 py-2 text-center">
          <p className="text-[#58739a]">Fats</p>
          <p className="mt-1 text-base text-[#20314a]">{formatPercent(fatKcal, total)}</p>
        </div>
      </div>
    </div>
  );
}

export default function Home({ user, goHome, goChat, goMetrics, goTrends, goProfile, goAi, goFoodLog, onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [selectedPrescriptionFile, setSelectedPrescriptionFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isScanningPrescription, setIsScanningPrescription] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [followUpHistory, setFollowUpHistory] = useState([]);
  const [isFetchingFollowUp, setIsFetchingFollowUp] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [todayIntake, setTodayIntake] = useState(DEFAULT_INTAKE);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const uploadInputRef = useRef(null);
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
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

      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isPrescriptionModalOpen && cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setIsCameraActive(false);
    }
  }, [isPrescriptionModalOpen]);

  // Fetch daily intake + activity summary for today
  useEffect(() => {
    async function fetchDailySummary() {
      if (!user?.id) return;

      try {
        const today = getIndiaDateString();
        const [nutritionResponse, smartwatchResponse] = await Promise.all([
          apiFetch(`/nutrition/summary?date=${today}`, { method: "GET" }),
          apiFetch(`/health/smartwatch/summary?date=${today}`, { method: "GET" }),
        ]);

        setTodayIntake((prev) => ({
          ...prev,
          totalCalories: nutritionResponse?.totalCalories || 0,
          protein: nutritionResponse?.totalProtein || 0,
          carbs: nutritionResponse?.totalCarbs || 0,
          fats: nutritionResponse?.totalFat || 0,
          calories: nutritionResponse?.totalCalories || 0,
          steps: smartwatchResponse?.totalSteps || 0,
          caloriesBurnt: smartwatchResponse?.totalCaloriesBurned || 0,
          stepsTarget: Number.isFinite(user?.targetSteps) ? user.targetSteps : prev.stepsTarget,
        }));
      } catch (err) {
        console.warn("Could not fetch daily summary:", err);
        // Use default values if fetch fails
      }
    }

    fetchDailySummary();

    // Keep dashboard responsive to newly available auth/session and background tab resumes.
    const interval = setInterval(fetchDailySummary, 60 * 1000);
    const onFocus = () => fetchDailySummary();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchDailySummary();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user?.id, user?.targetSteps]);

  useEffect(() => {
    if (!isCameraActive || !videoRef.current || !cameraStreamRef.current) {
      return;
    }

    const video = videoRef.current;
    video.srcObject = cameraStreamRef.current;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        setCameraError("Camera started, but preview could not autoplay. Tap Use Camera again.");
      });
    }
  }, [isCameraActive]);

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
    setCameraError("");
    event.target.value = "";
  }

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }

  async function startCamera() {
    setCameraError("");

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser.");
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 360 },
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
      setIsCameraActive(true);
    } catch {
      setCameraError("Camera permission denied or unavailable. Please allow camera access.");
      stopCamera();
    }
  }

  async function captureFromCamera() {
    if (!videoRef.current || !captureCanvasRef.current) {
      setCameraError("Camera is not ready yet.");
      return;
    }

    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Unable to capture image from camera.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      setCameraError("Unable to capture image from camera.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const file = new File([blob], `report-${Date.now()}.jpg`, { type: "image/jpeg" });
    const nextPreviewUrl = URL.createObjectURL(file);

    setSelectedPrescriptionFile(file);
    setPreviewUrl(nextPreviewUrl);
    setScanResult(null);
    setFollowUpHistory([]);
    setScanError("");
    setCameraError("");
    stopCamera();
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
      setScanError("Upload from gallery or capture from camera before scanning.");
      return;
    }

    setIsScanningPrescription(true);
    setScanError("");

    try {
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
    stopCamera();
    setIsPrescriptionModalOpen(false);
    setScanError("");
    setCameraError("");
  }

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-3 py-4 sm:px-4 sm:py-6 md:px-8 lg:px-10"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >

      {isIntakeModalOpen ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[rgba(10,20,34,0.56)] px-4 py-4">
          <div className="relative w-full max-w-[1120px] rounded-[1.9rem] border border-[#d0dbee] bg-[linear-gradient(180deg,#f9fbff,#e8f0fb)] p-4 shadow-[0_24px_52px_rgba(7,19,36,0.4)] md:p-5">
            <button
              type="button"
              onClick={() => setIsIntakeModalOpen(false)}
              className="absolute right-4 top-4 rounded-full border border-[#b6c6da] bg-white px-4 py-2 text-sm font-semibold text-[#29405e] shadow-sm"
            >
              Close
            </button>

            <div className="text-center">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.22em] text-[#58739a]">Daily Nutrition</p>
              <h3 className="mt-1 text-[2rem] font-semibold leading-none text-[#243652]" style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>
                Today Intake Details
              </h3>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[330px_1fr]">
              <div className="rounded-[1.5rem] border border-[#d2dcec] bg-white/90 p-4 shadow-[0_8px_18px_rgba(31,43,64,0.08)]">
                <IntakeRing intake={todayIntake} />
              </div>

              <div className="rounded-[1.5rem] border border-[#d2dcec] bg-white/90 p-4 shadow-[0_8px_18px_rgba(31,43,64,0.08)]">
                <p className="text-center text-[0.85rem] font-bold uppercase tracking-[0.16em] text-[#58739a]">Macro Breakdown</p>
                <div className="mt-4 space-y-3">
                  {(() => {
                    const proteinCals = todayIntake.protein * 4;
                    const carbsCals = todayIntake.carbs * 4;
                    const fatsCals = todayIntake.fats * 9;
                    const totalCals = proteinCals + carbsCals + fatsCals;
                    const proteinPct = totalCals > 0 ? Math.round((proteinCals / totalCals) * 100) : 0;
                    const carbsPct = totalCals > 0 ? Math.round((carbsCals / totalCals) * 100) : 0;
                    const fatsPct = totalCals > 0 ? Math.round((fatsCals / totalCals) * 100) : 0;

                    return (
                      <>
                        <div className="rounded-[1rem] border border-[#d2dcec] bg-[#f4f7fd] px-4 py-4 text-center">
                          <p className="text-[0.82rem] font-bold uppercase tracking-[0.16em] text-[#58739a]">Protein</p>
                          <p className="mt-2 text-[1.65rem] font-bold text-[#21314a]">{todayIntake.protein.toFixed(0)} g</p>
                          <p className="mt-1 text-sm text-[#6b7f99]">{proteinCals.toFixed(0)} kcal ({proteinPct}%)</p>
                        </div>
                        <div className="rounded-[1rem] border border-[#d2dcec] bg-[#f2fbf5] px-4 py-4 text-center">
                          <p className="text-[0.82rem] font-bold uppercase tracking-[0.16em] text-[#58739a]">Carbs</p>
                          <p className="mt-2 text-[1.65rem] font-bold text-[#21314a]">{todayIntake.carbs.toFixed(0)} g</p>
                          <p className="mt-1 text-sm text-[#6b7f99]">{carbsCals.toFixed(0)} kcal ({carbsPct}%)</p>
                        </div>
                        <div className="rounded-[1rem] border border-[#d2dcec] bg-[#fff5eb] px-4 py-4 text-center">
                          <p className="text-[0.82rem] font-bold uppercase tracking-[0.16em] text-[#58739a]">Fats</p>
                          <p className="mt-2 text-[1.65rem] font-bold text-[#21314a]">{todayIntake.fats.toFixed(0)} g</p>
                          <p className="mt-1 text-sm text-[#6b7f99]">{fatsCals.toFixed(0)} kcal ({fatsPct}%)</p>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="mt-3 rounded-[1rem] border border-[#d2dcec] bg-white px-4 py-3 text-center text-[0.95rem] font-semibold text-[#58739a]">
                  Source: Food Log table totals for the running day.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#71bcff_0%,rgba(113,188,255,0.32)_56%,transparent_100%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#69dcb0_0%,rgba(105,220,176,0.28)_56%,transparent_100%)] blur-2xl" />

      <motion.div
        className="pointer-events-none absolute left-1/2 top-16 h-24 w-[82%] max-w-[460px] -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(31,43,64,0),rgba(31,43,64,0.22),rgba(31,43,64,0))] blur-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.45 }}
        transition={{ duration: 1.1 }}
      />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[1100px] flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:min-h-[calc(100vh-3rem)]"
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
          <p className="mt-2 text-sm font-medium text-[#6a7a94]">
            {currentDateTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} • {currentDateTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>

        <main className="grid grid-cols-2 gap-3.5 md:grid-cols-4 md:gap-3">
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
            className="col-span-2 min-h-[106px] rounded-[1.35rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 py-3 text-left text-white shadow-[0_12px_22px_rgba(17,29,46,0.26)] md:col-span-2"
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
              Report Insights
            </p>
          </button>

          <button
            type="button"
            onClick={goFoodLog}
            className="min-h-[106px] rounded-[1.35rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 py-3 text-left text-white shadow-[0_12px_22px_rgba(17,29,46,0.26)]"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 3v18" />
              <path d="M4 7h10" />
              <path d="M4 12h8" />
              <path d="M4 17h10" />
            </svg>
            <p className="mt-1 text-[1.55rem] font-bold leading-[1.03] tracking-[-0.01em]" style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>
              Food Log
            </p>
          </button>

          <MiniProgressCard
            title="Today Steps"
            value={todayIntake.steps.toString()}
            target={`${todayIntake.stepsTarget.toLocaleString()}`}
            progress={todayIntake.stepsTarget > 0 ? Math.min(todayIntake.steps / todayIntake.stepsTarget, 1) : 0}
            color="#5ed1a6"
            subtitle="Walked today"
          />

          <MiniProgressCard
            title="Total Burn"
            value={todayIntake.caloriesBurnt.toFixed(0)}
            progress={todayIntake.totalCalories > 0 ? Math.min(todayIntake.caloriesBurnt / todayIntake.totalCalories, 1) : 0}
            color="#f4a164"
            subtitle="Calories burned"
          />

          <button
            type="button"
            onClick={() => setIsIntakeModalOpen(true)}
            className="rounded-[1.35rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 py-3 text-left text-white shadow-[0_12px_22px_rgba(17,29,46,0.26)]"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#a7c1e4]">Today Intake</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="relative grid h-16 w-16 place-items-center rounded-full bg-[conic-gradient(#4f91f2_0_20.5%,#5ed1a6_20.5%_65.9%,#f4a164_65.9%_100%)] p-1">
                <div className="grid h-full w-full place-items-center rounded-full bg-[#22334f] text-center">
                  <span className="text-[0.78rem] font-bold text-white">{todayIntake.totalCalories}</span>
                </div>
              </div>
              <div>
                <p className="text-[1.1rem] font-bold leading-none">{todayIntake.totalCalories}</p>
                <p className="mt-1 text-[0.76rem] text-[#d6e4f8]">P {todayIntake.protein.toFixed(0)}g | C {todayIntake.carbs.toFixed(0)}g | F {todayIntake.fats.toFixed(0)}g</p>
                <p className="mt-1 text-[0.76rem] font-semibold text-[#a7c1e4]">kcal intake</p>
              </div>
            </div>
          </button>
        </main>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(0.7rem+env(safe-area-inset-bottom))] sm:px-4 md:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1100px]">
            <div className="pointer-events-auto md:mx-auto md:w-full md:max-w-[760px]">
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
          </div>
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
                Report Insights
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
                Upload From Gallery
              </button>
              <button
                type="button"
                onClick={startCamera}
                className="rounded-xl border border-[#adbdd4] bg-white/80 px-3 py-2 text-sm font-semibold text-[#223752]"
              >
                Use Camera
              </button>
            </div>

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              onChange={handlePrescriptionFileChange}
              className="hidden"
            />

            {isCameraActive ? (
              <div className="mt-3 rounded-xl border border-[#bccbdd] bg-white/80 p-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#4e6486]">Camera Preview</p>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-36 w-full rounded-lg border border-[#d1dbeb] bg-[#0f1a2a] object-cover"
                />
                <canvas ref={captureCanvasRef} className="hidden" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={captureFromCamera}
                    className="rounded-lg border border-[#2d4e76] bg-[linear-gradient(145deg,#2b5587,#2a4d7b)] px-2 py-2 text-xs font-semibold text-white"
                  >
                    Capture
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-lg border border-[#a9bbd3] bg-white px-2 py-2 text-xs font-semibold text-[#29405e]"
                  >
                    Stop Camera
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-3 min-h-[120px] rounded-xl border border-[#bccbdd] bg-white/70 p-2">
              {previewUrl ? (
                <img src={previewUrl} alt="Selected report" className="h-32 w-full rounded-lg object-cover md:h-44" />
              ) : (
                <p className="pt-10 text-center text-xs font-medium text-[#4e6486]">Upload from gallery or capture in the camera window to begin scanning.</p>
              )}
            </div>

            {cameraError ? <p className="mt-2 text-xs font-semibold text-[#8f2b2b]">{cameraError}</p> : null}

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
