import { useState, useEffect } from "react";
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
  const [mealDraft, setMealDraft] = useState("");
  const [foodLogRows, setFoodLogRows] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const todayDate = getIndiaDateString();
  const isViewingToday = selectedDate === todayDate;

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

  async function handleMealSubmit(event) {
    event.preventDefault();

    if (!isViewingToday) {
      setAnalysisError("You can only add meals for today. Switch View Date to today to log food.");
      return;
    }

    const nextMeal = mealDraft.trim();
    if (!nextMeal) return;

    setIsAnalyzing(true);
    setAnalysisError("");

    try {
      const response = await apiFetch("/nutrition/analyze", {
        method: "POST",
        body: JSON.stringify({ description: nextMeal }),
      });

      const now = new Date();
      const timestamp = now.toISOString();

      const newFood = {
        name: response.name,
        servingSize: response.servingSize,
        calories: response.calories,
        protein: response.protein,
        totalFat: response.totalFat,
        saturatedFat: response.saturatedFat,
        cholesterol: response.cholesterol,
        sodium: response.sodium,
        carbohydrates: response.carbohydrates,
        fiber: response.fiber,
        sugars: response.sugars,
        date: todayDate,
        timestamp: timestamp,
      };

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
      setMealDraft("");
    } catch {
      setAnalysisError("Unable to analyze food. Please try again.");
    } finally {
      setIsAnalyzing(false);
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
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-4 py-6 md:px-8 lg:px-10"
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

          <form onSubmit={handleMealSubmit} className="mt-4 rounded-[1.2rem] border border-[#d2dcec] bg-white/90 p-3 shadow-[0_8px_18px_rgba(31,43,64,0.06)]">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#58739a]">Add Meal</p>
            
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:gap-2">
              <div className="flex flex-col gap-1 md:w-40">
                <label className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#58739a]">View Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="h-14 rounded-[1rem] border border-[#c7d3e3] bg-white px-4 text-[1rem] text-[#20314a] outline-none placeholder:text-[#7a8da8] focus:border-[#8aa2c0]"
                />
              </div>

              <input
                value={mealDraft}
                onChange={(event) => setMealDraft(event.target.value)}
                placeholder="Example: Paneer sandwich 250g"
                className="h-14 flex-1 rounded-[1rem] border border-[#c7d3e3] bg-white px-4 text-[1rem] text-[#20314a] outline-none placeholder:text-[#7a8da8] focus:border-[#8aa2c0]"
              />
              <button
                type="submit"
                disabled={isAnalyzing || isSaving || !isViewingToday}
                className="h-14 shrink-0 rounded-[1rem] bg-[linear-gradient(145deg,#294c78,#2b5c92)] px-5 text-[1rem] font-bold text-white shadow-[0_10px_20px_rgba(41,76,120,0.22)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isAnalyzing || isSaving ? "Saving..." : "Enter Next Meal"}
              </button>
            </div>
            <div className="mt-3 rounded-[0.9rem] border border-[#dbe4f0] bg-[#f7fafe] px-3 py-2 text-sm font-semibold text-[#4e6486]">
              {analysisError ? (
                <p className="text-[#8f2b2b]">{analysisError}</p>
              ) : isAnalyzing || isSaving ? (
                <p>Analyzing and saving...</p>
              ) : !isViewingToday ? (
                <p>Viewing logs for {selectedDate}. You can only add meals for today ({todayDate}).</p>
              ) : foodLogRows.length > 0 ? (
                <p>{foodLogRows.length} item{foodLogRows.length !== 1 ? "s" : ""} logged for {selectedDate}</p>
              ) : (
                `Enter a food item with portion size to see nutritional values for ${selectedDate}`
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
