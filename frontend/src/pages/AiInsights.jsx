import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../api/client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CircularMetric({ label, value, suffix, progress, color }) {
  const hasValue = Number.isFinite(value);

  return (
    <div className="rounded-2xl border border-[#c8d4e6] bg-white/70 px-2 py-3 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center">
        <svg viewBox="0 0 100 100" className="h-20 w-20" fill="none" aria-hidden="true">
          <circle cx="50" cy="50" r="38" stroke="rgba(126,146,176,0.28)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${(progress * 100).toFixed(1)} 100`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="pointer-events-none absolute text-[1rem] font-bold text-[#1b2f4a]">
          {hasValue ? value.toFixed(1) : "--"}
        </div>
      </div>
      <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#4a6285]">{label}</p>
      <p className="text-[0.72rem] font-medium text-[#2a4264]">{hasValue ? `${value.toFixed(1)} ${suffix}` : "Not set"}</p>
    </div>
  );
}

function normalizeSeries(series, fallback) {
  if (!Array.isArray(series) || series.length !== 7) return fallback;
  const parsed = series.map((value) => Number(value));
  return parsed.every((value) => Number.isFinite(value)) ? parsed : fallback;
}

function sumSeries(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== 7 || right.length !== 7) {
    return null;
  }

  const result = left.map((value, index) => Number(value) + Number(right[index]));
  return result.every((value) => Number.isFinite(value)) ? result : null;
}

function findMaxIndex(values) {
  let bestIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[bestIndex]) {
      bestIndex = index;
    }
  }
  return bestIndex;
}

function findMinIndex(values) {
  let bestIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[bestIndex]) {
      bestIndex = index;
    }
  }
  return bestIndex;
}

export default function AiInsights({ user, goBack }) {
  const [selectedGoal, setSelectedGoal] = useState("Maintain Weight");
  const [recommendation, setRecommendation] = useState("Loading recommendation...");
  const [goalOutput, setGoalOutput] = useState("Loading goal output...");
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [trendsError, setTrendsError] = useState("");
  const [activeActivityCard, setActiveActivityCard] = useState(0);
  const [weeklySleep, setWeeklySleep] = useState([6.5, 7.1, 6.8, 7.4, 7.0, 8.0, 7.6]);
  const [weeklySteps, setWeeklySteps] = useState([6100, 7400, 6900, 8200, 9100, 10200, 8800]);
  const [weeklyCaloriesBurnt, setWeeklyCaloriesBurnt] = useState([1940, 2025, 1982, 2080, 2154, 2210, 2117]);
  const [weeklyBloodGlucose, setWeeklyBloodGlucose] = useState([102, 110, 106, 98, 104, 100, 96]);

  const goals = [
    "Lose Weight ⚖️",
    "Maintain Weight 🎯",
    "Build Muscle 💪",
    "Improve Stamina 🏃",
    "Improve Sleep 💤",
    "Boost Energy ⚡",
    "Eat Healthier 🍎",
    "Stay Consistent 🔥",
  ];

  const bmi = Number.isFinite(user?.heightCm) && Number.isFinite(user?.weightKg)
    ? user.weightKg / ((user.heightCm / 100) * (user.heightCm / 100))
    : null;
  const heightValue = Number.isFinite(user?.heightCm) ? user.heightCm : null;
  const weightValue = Number.isFinite(user?.weightKg) ? user.weightKg : null;

  const bmiProgress = bmi ? Math.min(Math.max(bmi / 40, 0), 1) : 0;
  const heightProgress = heightValue ? Math.min(Math.max(heightValue / 220, 0), 1) : 0;
  const weightProgress = weightValue ? Math.min(Math.max(weightValue / 140, 0), 1) : 0;

  const normalizedGoal = useMemo(
    () => selectedGoal.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim(),
    [selectedGoal]
  );

  const aiInsightsEndpoint = import.meta.env.VITE_AI_INSIGHTS_ENDPOINT || "/api/ai-insights";
  const trendsEndpoint = import.meta.env.VITE_TRENDS_ENDPOINT || "/api/trends-weekly";

  const activityCards = useMemo(() => {
    const bestStepsIndex = findMaxIndex(weeklySteps);
    const bestSleepIndex = findMaxIndex(weeklySleep);
    const bestCaloriesIndex = findMaxIndex(weeklyCaloriesBurnt);
    const bestGlucoseIndex = findMinIndex(weeklyBloodGlucose);

    return [
      {
        id: "steps",
        eyebrow: "Movement Highlight",
        title: `You walked the max steps on ${DAYS[bestStepsIndex]}`,
        value: `${Math.round(weeklySteps[bestStepsIndex])} steps`,
        note: "Strong activity day. Repeat the same routine this week.",
        chip: "bg-[linear-gradient(160deg,#49cfa7,#2f9f86)]",
      },
      {
        id: "sleep",
        eyebrow: "Sleep Highlight",
        title: `You got the best sleep on ${DAYS[bestSleepIndex]}`,
        value: `${weeklySleep[bestSleepIndex].toFixed(1)} hours`,
        note: "Your recovery was best here. Mirror that bedtime pattern.",
        chip: "bg-[linear-gradient(160deg,#6a8fff,#4c6ad8)]",
      },
      {
        id: "calories",
        eyebrow: "Burn Highlight",
        title: `You burnt the most total calories on ${DAYS[bestCaloriesIndex]}`,
        value: `${Math.round(weeklyCaloriesBurnt[bestCaloriesIndex])} kcal`,
        note: "This includes active plus resting calories. Great full-day energy output.",
        chip: "bg-[linear-gradient(160deg,#f3a06f,#dc7b44)]",
      },
      {
        id: "glucose",
        eyebrow: "Glucose Highlight",
        title: `Your best glucose level was on ${DAYS[bestGlucoseIndex]}`,
        value: `${Math.round(weeklyBloodGlucose[bestGlucoseIndex])} mg/dL`,
        note: "Most stable reading this week. Keep meals and timing consistent.",
        chip: "bg-[linear-gradient(160deg,#ef8ea8,#cb607a)]",
      },
    ];
  }, [weeklyBloodGlucose, weeklyCaloriesBurnt, weeklySleep, weeklySteps]);

  const currentActivityCard = activityCards[activeActivityCard] || activityCards[0];

 useEffect(() => {
  async function fetchInsights() {
    setIsLoadingInsights(true);
    setInsightsError("");
    try {
      const data = await apiFetch("/insights/", { method: "POST" });
      setRecommendation(data.explanation || data.recommendations?.[0] || "No recommendation returned.");
      setGoalOutput(
        data.recommendations?.find(r => r.toLowerCase().includes(normalizedGoal.toLowerCase()))
        || data.recommendations?.[0]
        || "No goal output returned."
      );
    } catch {
      setInsightsError("Backend insights unavailable right now.");
      setRecommendation("No recommendation available.");
      setGoalOutput("No goal output available.");
    } finally {
      setIsLoadingInsights(false);
    }
  }
  fetchInsights();
}, [normalizedGoal]);

  useEffect(() => {
  async function fetchTrends() {
    setIsLoadingTrends(true);
    setTrendsError("");
    try {
      const data = await apiFetch("/health/trends", { method: "GET" });
      setWeeklySleep(prev => normalizeSeries(data.weeklySleep, prev));
      setWeeklySteps(prev => normalizeSeries(data.weeklySteps, prev));
      setWeeklyCaloriesBurnt(prev => {
        const total = normalizeSeries(data.weeklyTotalCaloriesBurnt, prev);
        if (total !== prev) return total;
        const combined = sumSeries(data.weeklyActiveCaloriesBurnt, data.weeklyRestingCaloriesBurnt);
        return combined || normalizeSeries(data.weeklyCaloriesBurnt, prev);
      });
      setWeeklyBloodGlucose(prev => normalizeSeries(data.weeklyBloodGlucose, prev));
      setActiveActivityCard(0);
    } catch {
      setTrendsError("Trend highlights are using recent cached values right now.");
    } finally {
      setIsLoadingTrends(false);
    }
  }
  fetchTrends();
}, [user?.id]);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-4 py-6 md:px-8 lg:px-10"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#71bcff_0%,rgba(113,188,255,0.32)_56%,transparent_100%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#69dcb0_0%,rgba(105,220,176,0.28)_56%,transparent_100%)] blur-2xl" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[980px] flex-col"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            className="rounded-full border border-[#95a8c4] bg-[rgba(255,255,255,0.7)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#29405e]"
          >
            Back
          </button>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#3b4f6d]">AI Insights</p>
        </header>

        <section className="rounded-[1.4rem] border border-white/35 bg-[rgba(255,255,255,0.62)] p-4 shadow-[0_10px_22px_rgba(31,43,64,0.14)] md:p-5">
          <p className="text-sm font-semibold text-[#2b4467]">Current Snapshot</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <CircularMetric label="BMI" value={bmi} suffix="" progress={bmiProgress} color="#4ea9ff" />
            <CircularMetric label="Height" value={heightValue} suffix="cm" progress={heightProgress} color="#4dd7a6" />
            <CircularMetric label="Weight" value={weightValue} suffix="kg" progress={weightProgress} color="#9b8cff" />
          </div>
        </section>

        <section className="mt-3 rounded-[1.4rem] border border-white/35 bg-[rgba(255,255,255,0.62)] p-4 shadow-[0_10px_22px_rgba(31,43,64,0.14)] md:p-5">
          <p className="text-sm font-semibold text-[#2b4467]">Daily Activity Snapshot</p>
          {isLoadingTrends ? <p className="mt-2 text-xs font-semibold text-[#3c5374]">Loading activity highlights...</p> : null}
          {trendsError ? <p className="mt-2 text-xs font-semibold text-[#9e2f2f]">{trendsError}</p> : null}

          <div className="mt-3 rounded-[1.2rem] border border-white/30 bg-[linear-gradient(145deg,#1b273a,#27344a)] p-4 text-white shadow-[0_10px_22px_rgba(17,29,46,0.2)]">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#a7c1e4]">{currentActivityCard.eyebrow}</p>
            <p className="mt-2 text-[1.03rem] font-bold leading-[1.2]" style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>
              {currentActivityCard.title}
            </p>
            <p className={`mt-3 inline-block rounded-lg px-3 py-2 text-sm font-bold text-white ${currentActivityCard.chip}`}>
              {currentActivityCard.value}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#d6e4f8]">{currentActivityCard.note}</p>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveActivityCard((previous) => (previous - 1 + activityCards.length) % activityCards.length)}
                className="rounded-lg border border-[#758fb0] bg-white/10 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#e9f2ff]"
              >
                Previous
              </button>

              <div className="flex items-center gap-2">
                {activityCards.map((card, index) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setActiveActivityCard(index)}
                    aria-label={`Show ${card.id} highlight`}
                    className={`h-2.5 w-2.5 rounded-full ${index === activeActivityCard ? "bg-[#8fd0ff]" : "bg-white/35"}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setActiveActivityCard((previous) => (previous + 1) % activityCards.length)}
                className="rounded-lg border border-[#758fb0] bg-white/10 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#e9f2ff]"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-[1.4rem] border border-white/30 bg-[linear-gradient(145deg,#1b273a,#27344a)] p-4 text-white shadow-[0_12px_26px_rgba(17,29,46,0.28)] md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#aac4e7]">Recommendation</p>
          <p className="mt-2 text-[0.98rem] leading-relaxed">{isLoadingInsights ? "Loading recommendation..." : recommendation}</p>
          {insightsError ? <p className="mt-2 text-xs font-semibold text-amber-300">{insightsError}</p> : null}
        </section>

        <section className="mt-3 rounded-[1.25rem] border border-white/35 bg-[rgba(255,255,255,0.62)] p-4 shadow-[0_10px_22px_rgba(31,43,64,0.14)] md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#3b4f6d]">Goal Focus</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {goals.map((goal) => {
              const isSelected = selectedGoal === goal;
              return (
                <button
                  key={goal}
                  type="button"
                  onClick={() => setSelectedGoal(goal)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                    isSelected
                      ? "border-[#1f3f35] bg-[linear-gradient(160deg,#1f5a4b,#143c32)] text-white"
                      : "border-[#b9c8db] bg-white/70 text-[#22354f]"
                  }`}
                >
                  {goal}
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-[#b8c7da] bg-white/75 px-3 py-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#41587a]">Selected Goal Output</p>
            <p className="mt-1 text-sm leading-relaxed text-[#1f3049]">
              {isLoadingInsights ? "Loading goal output..." : goalOutput}
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
