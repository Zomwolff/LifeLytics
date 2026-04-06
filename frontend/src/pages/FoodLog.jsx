import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../api/client";

function getIndiaDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function FoodLog({ user, goBack }) {
  const [selectedDate, setSelectedDate] = useState(getIndiaDateString());
  const [foodLogRows, setFoodLogRows] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [isDetectingFromPhoto, setIsDetectingFromPhoto] = useState(false);
  const [photoCandidates, setPhotoCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [manualFoodName, setManualFoodName] = useState("");
  const [servingGrams, setServingGrams] = useState("100");
  const [photoError, setPhotoError] = useState("");
  const [isResolvingPhotoMeal, setIsResolvingPhotoMeal] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const uploadInputRef = useRef(null);
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const todayDate = getIndiaDateString();
  const isViewingToday = selectedDate === todayDate;

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

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

  function calculateTotals(items) {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalSaturatedFat = 0;
    let totalCholesterol = 0;
    let totalSodium = 0;
    let totalCarbs = 0;
    let totalFiber = 0;
    let totalSugars = 0;
    let totalServingSize = 0;

    items.forEach((item) => {
      totalCalories += parseFloat(item.calories) || 0;
      totalProtein += parseFloat(item.protein) || 0;
      totalFat += parseFloat(item.totalFat) || 0;
      totalSaturatedFat += parseFloat(item.saturatedFat) || 0;
      totalCholesterol += parseFloat(item.cholesterol) || 0;
      totalSodium += parseFloat(item.sodium) || 0;
      totalCarbs += parseFloat(item.carbohydrates) || 0;
      totalFiber += parseFloat(item.fiber) || 0;
      totalSugars += parseFloat(item.sugars) || 0;
      totalServingSize += parseFloat(item.servingSize) || 0;
    });

    return {
      name: "Total",
      servingSize: `${totalServingSize.toFixed(0)}g`,
      calories: totalCalories.toFixed(1),
      protein: `${totalProtein.toFixed(0)}g`,
      totalFat: `${totalFat.toFixed(1)}g`,
      saturatedFat: `${totalSaturatedFat.toFixed(1)}g`,
      cholesterol: `${totalCholesterol.toFixed(0)}mg`,
      sodium: `${totalSodium.toFixed(0)}mg`,
      carbohydrates: `${totalCarbs.toFixed(1)}g`,
      fiber: `${totalFiber.toFixed(1)}g`,
      sugars: `${totalSugars.toFixed(1)}g`,
    };
  }

  function buildMealFromNutrition(nutrition) {
    const now = new Date();
    const timestamp = now.toISOString();

    return {
      name: nutrition.name,
      servingSize: nutrition.servingSize,
      calories: nutrition.calories,
      protein: nutrition.protein,
      totalFat: nutrition.totalFat,
      saturatedFat: nutrition.saturatedFat,
      cholesterol: nutrition.cholesterol,
      sodium: nutrition.sodium,
      carbohydrates: nutrition.carbohydrates,
      fiber: nutrition.fiber,
      sugars: nutrition.sugars,
      date: todayDate,
      timestamp,
    };
  }

  async function saveMealRow(newFood) {
    // Save to Firestore
    if (user?.id) {
      setIsSaving(true);
      try {
        await apiFetch("/nutrition/save-meal", {
          method: "POST",
          body: JSON.stringify({
            userId: user.id,
            date: todayDate,
            meal: newFood,
          }),
        });
      } catch (err) {
        console.warn("Could not save to database:", err);
      } finally {
        setIsSaving(false);
      }
    }

    setFoodLogRows((prev) => [...prev, newFood]);
  }

  async function processPhotoFile(file) {
    if (!file) return;

    if (!isViewingToday) {
      setPhotoError("You can only add meals for today. Switch View Date to today to log food.");
      return;
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoCandidates([]);
    setSelectedCandidate("");
    setManualFoodName("");
    setPhotoError("");
    setCameraError("");

    setIsDetectingFromPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch("/nutrition/image-detect", {
        method: "POST",
        body: formData,
      });

      const candidates = Array.isArray(response.candidates) ? response.candidates : [];
      setPhotoCandidates(candidates);
      if (candidates.length > 0) {
        setSelectedCandidate(candidates[0].name);
      }
    } catch {
      setPhotoError("Could not detect food from image. Please type the name manually.");
    } finally {
      setIsDetectingFromPhoto(false);
    }
  }

  async function handlePhotoSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    await processPhotoFile(file);
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

    const file = new File([blob], `meal-${Date.now()}.jpg`, { type: "image/jpeg" });
    await processPhotoFile(file);
    stopCamera();
  }

  async function handleConfirmPhotoMeal() {
    if (!isViewingToday) {
      setPhotoError("You can only add meals for today.");
      return;
    }

    const confirmedName = (manualFoodName || selectedCandidate || "").trim();
    if (!confirmedName) {
      setPhotoError("Select a detected food or type the food name.");
      return;
    }

    const grams = Number(servingGrams);
    if (!Number.isFinite(grams) || grams <= 0) {
      setPhotoError("Please enter a valid serving size in grams.");
      return;
    }

    setPhotoError("");
    setIsResolvingPhotoMeal(true);
    try {
      const response = await apiFetch("/nutrition/image-confirm", {
        method: "POST",
        body: JSON.stringify({
          foodName: confirmedName,
          servingGrams: grams,
        }),
      });

      const nutrition = response.nutrition || {};
      const newFood = buildMealFromNutrition(nutrition);
      await saveMealRow(newFood);

      setPhotoCandidates([]);
      setSelectedCandidate("");
      setManualFoodName("");
      setServingGrams("100");
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
      setPhotoPreview("");
    } catch {
      setPhotoError("Could not resolve nutrition from this photo right now.");
    } finally {
      setIsResolvingPhotoMeal(false);
    }
  }

  // Load meals for selected date
  useEffect(() => {
    async function loadMealsForDate() {
      if (!user?.id || !selectedDate) return;

      try {
        const response = await apiFetch(`/nutrition/meals?userId=${user.id}&date=${selectedDate}`, {
          method: "GET",
        });

        if (Array.isArray(response.meals)) {
          setFoodLogRows(response.meals);
        }
      } catch {
        // Silently fail, meals already in state
      }
    }

    loadMealsForDate();
  }, [selectedDate, user?.id]);

  const displayRows =
    foodLogRows.length > 0
      ? [calculateTotals(foodLogRows), ...foodLogRows]
      : [];

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6 md:px-8 lg:px-10"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            className="rounded-[0.9rem] border border-[#a8bad2] bg-white/70 px-3 py-2 text-sm font-semibold text-[#27425f] shadow-sm"
          >
            Back
          </button>
          <h1
            className="text-[1.9rem] font-semibold leading-none text-[#26384f]"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            Food Log
          </h1>
          <div className="w-[60px]" aria-hidden="true" />
        </div>

        <section className="mt-4 rounded-[1.5rem] border border-white/40 bg-[rgba(245,248,253,0.86)] px-4 py-4 shadow-[0_12px_26px_rgba(31,43,64,0.12)] md:px-5">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-[1.9rem] font-semibold leading-none text-[#26384f]" style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>
                Today Overview
              </h2>
              <p className="mt-2 text-sm font-semibold text-[#9e2f2f]">Using latest cached values right now.</p>
            </div>
          </div>

          <form className="mt-4 rounded-[1.2rem] border border-[#d2dcec] bg-white/90 p-3 shadow-[0_8px_18px_rgba(31,43,64,0.06)]">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#58739a]">Add Meal</p>
            
            <div className="mt-3 flex flex-col gap-3 md:w-40">
              <div className="flex flex-col gap-1 md:w-40">
                <label className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#58739a]">View Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="h-14 rounded-[1rem] border border-[#c7d3e3] bg-white px-4 text-[1rem] text-[#20314a] outline-none placeholder:text-[#7a8da8] focus:border-[#8aa2c0]"
                />
              </div>
            </div>

            <div className="mt-4 rounded-[0.95rem] border border-[#d2dcec] bg-[#f9fbff] p-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#58739a]">From Food Photo</p>
              <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                <label className="inline-flex h-12 cursor-pointer items-center justify-center rounded-[0.9rem] border border-[#9db0c9] bg-white px-4 text-sm font-semibold text-[#29405e] shadow-sm">
                  Upload From Gallery
                  <input ref={uploadInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex h-12 items-center justify-center rounded-[0.9rem] border border-[#9db0c9] bg-white px-4 text-sm font-semibold text-[#29405e] shadow-sm"
                >
                  Use Camera
                </button>
                <input
                  value={manualFoodName}
                  onChange={(event) => setManualFoodName(event.target.value)}
                  placeholder="If needed, type food name"
                  className="h-12 flex-1 rounded-[0.9rem] border border-[#c7d3e3] bg-white px-3 text-[0.95rem] text-[#20314a] outline-none placeholder:text-[#7a8da8]"
                />
                <input
                  type="number"
                  min="1"
                  value={servingGrams}
                  onChange={(event) => setServingGrams(event.target.value)}
                  className="h-12 w-full rounded-[0.9rem] border border-[#c7d3e3] bg-white px-3 text-[0.95rem] text-[#20314a] outline-none md:w-28"
                />
                <button
                  type="button"
                  onClick={handleConfirmPhotoMeal}
                  disabled={isDetectingFromPhoto || isResolvingPhotoMeal || isSaving || !isViewingToday}
                  className="h-12 shrink-0 rounded-[0.9rem] bg-[linear-gradient(145deg,#1f4d3f,#1b6a56)] px-4 text-sm font-bold text-white shadow-[0_10px_20px_rgba(27,106,86,0.2)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isDetectingFromPhoto ? "Detecting..." : isResolvingPhotoMeal ? "Adding..." : "Confirm & Add"}
                </button>
              </div>

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

              {photoPreview ? (
                <div className="mt-3">
                  <img src={photoPreview} alt="Selected meal" className="h-32 w-32 rounded-lg border border-[#c7d3e3] object-cover" />
                </div>
              ) : null}

              {photoCandidates.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photoCandidates.map((candidate) => (
                    <button
                      key={candidate.name}
                      type="button"
                      onClick={() => setSelectedCandidate(candidate.name)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${selectedCandidate === candidate.name ? "border-[#2f5f96] bg-[#e8f0fb] text-[#1c3c60]" : "border-[#c6d2e2] bg-white text-[#4a607f]"}`}
                    >
                      {candidate.name} ({Math.round((candidate.confidence || 0) * 100)}%)
                    </button>
                  ))}
                </div>
              ) : null}

              {cameraError ? <p className="mt-2 text-sm font-semibold text-[#8f2b2b]">{cameraError}</p> : null}
              {photoError ? <p className="mt-2 text-sm font-semibold text-[#8f2b2b]">{photoError}</p> : null}
            </div>

            <div className="mt-3 rounded-[0.9rem] border border-[#dbe4f0] bg-[#f7fafe] px-3 py-2 text-sm font-semibold text-[#4e6486]">
              {photoError ? (
                <p className="text-[#8f2b2b]">{photoError}</p>
              ) : isDetectingFromPhoto || isResolvingPhotoMeal || isSaving ? (
                <p>Detecting and saving...</p>
              ) : !isViewingToday ? (
                <p>Viewing logs for {selectedDate}. You can only add meals for today ({todayDate}).</p>
              ) : foodLogRows.length > 0 ? (
                <p>{foodLogRows.length} item{foodLogRows.length !== 1 ? "s" : ""} logged for {selectedDate}</p>
              ) : (
                `Upload food photo, confirm the item, and add nutrition for ${selectedDate}`
              )}
            </div>
          </form>

          <div className="mt-4 overflow-x-auto rounded-[1.4rem] border border-[#d2dcec] bg-white shadow-[0_10px_22px_rgba(31,43,64,0.08)]">
            <div className="border-b border-[#d2dcec] bg-[linear-gradient(180deg,#f7f9fd,#eef3fa)] px-4 py-4 text-center">
              <h3 className="text-[2rem] font-medium text-[#495d77]" style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>
                Nutrition Results
              </h3>
            </div>
            {displayRows.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-[#4e6486]">No meals logged yet. Add a meal to see nutritional breakdown.</p>
              </div>
            ) : (
              <table className="min-w-[1120px] w-full border-collapse text-left">
                <thead className="bg-[#2f3a49] text-white">
                  <tr>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Name</th>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Serving Size</th>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Calories</th>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Protein</th>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Total Fat</th>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Saturated Fat</th>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Cholesterol</th>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Sodium</th>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Carbohydrates</th>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Fiber</th>
                    <th className="px-4 py-4 text-[0.92rem] font-semibold">Sugars</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, index) => (
                    <tr key={`${row.name}-${index}`} className={index === 0 ? "bg-[#e3e6ec]" : index % 2 === 0 ? "bg-[#f9fafc]" : "bg-white"}>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] font-semibold text-[#2d3747]">{row.name}</td>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] text-[#2d3747]">{row.servingSize}</td>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] text-[#2d3747]">{row.calories}</td>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] text-[#2d3747]">{row.protein}</td>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] text-[#2d3747]">{row.totalFat}</td>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] text-[#2d3747]">{row.saturatedFat}</td>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] text-[#2d3747]">{row.cholesterol}</td>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] text-[#2d3747]">{row.sodium}</td>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] text-[#2d3747]">{row.carbohydrates}</td>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] text-[#2d3747]">{row.fiber}</td>
                      <td className="border-t border-[#d8e0eb] px-4 py-4 text-[1rem] text-[#2d3747]">{row.sugars}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
