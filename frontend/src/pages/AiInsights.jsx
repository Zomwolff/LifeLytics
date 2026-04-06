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

function getNumericSeries(values) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => Number(value) || 0);
}

function getRandomIndexFromSeries(values, mode = "high") {
  const numericValues = getNumericSeries(values);
  if (numericValues.length === 0) return 0;

  const positiveEntries = numericValues
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value > 0);

  if (positiveEntries.length === 0) {
    return Math.floor(Math.random() * numericValues.length);
  }

  const rankedEntries = positiveEntries
    .sort((left, right) => (mode === "low" ? left.value - right.value : right.value - left.value))
    .slice(0, Math.min(3, positiveEntries.length));

  const weights = rankedEntries.map(({ value }) => (mode === "low" ? 1 / (value + 1) : value));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let cursor = Math.random() * totalWeight;

  for (let position = 0; position < rankedEntries.length; position += 1) {
    cursor -= weights[position];
    if (cursor <= 0) {
      return rankedEntries[position].index;
    }
  }

  return rankedEntries[0].index;
}

function getSeriesScore(values) {
  return getNumericSeries(values).reduce((sum, value) => sum + Math.max(value, 0), 0);
}

function getFeaturedCardIndex(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return 0;

  const weightedCards = cards
    .map((card, index) => ({ index, score: card.score || 0 }))
    .filter(({ score }) => score > 0);

  if (weightedCards.length === 0) {
    return Math.floor(Math.random() * cards.length);
  }

  const totalWeight = weightedCards.reduce((sum, item) => sum + item.score, 0);
  let cursor = Math.random() * totalWeight;

  for (const item of weightedCards) {
    cursor -= item.score;
    if (cursor <= 0) {
      return item.index;
    }
  }

  return weightedCards[0].index;
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function formatSigned(value, unit) {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}${unit}`;
}

function buildSmartSummary({
  weeklySleep,
  weeklySteps,
  weeklyCaloriesBurnt,
  weeklyCaloriesIntake,
  weeklyProtein,
  weeklyCarbs,
  weeklyFats,
  weeklyBloodGlucose,
  caloriesTarget,
  selectedGoal,
}) {
  const avgSleep = average(weeklySleep);
  const avgSteps = average(weeklySteps);
  const avgBurn = average(weeklyCaloriesBurnt);
  const avgIntake = average(weeklyCaloriesIntake);
  const avgProtein = average(weeklyProtein);
  const avgCarbs = average(weeklyCarbs);
  const avgFats = average(weeklyFats);
  const avgGlucose = average(weeklyBloodGlucose);

  const caloriesGap = avgIntake - (Number(caloriesTarget) || 0);
  const intakeStatus = caloriesGap > 0 ? `above your target by ${Math.round(caloriesGap)} kcal` : `below your target by ${Math.abs(Math.round(caloriesGap))} kcal`;
  const activityStatus = avgSteps < 7000 ? `Your movement is a bit low at ${Math.round(avgSteps).toLocaleString()} steps/day.` : `Your movement is solid at ${Math.round(avgSteps).toLocaleString()} steps/day.`;
  const proteinStatus = avgProtein < 70 ? `Protein is low at ${Math.round(avgProtein)} g/day.` : `Protein is holding up at ${Math.round(avgProtein)} g/day.`;
  const glucoseStatus = avgGlucose > 110 ? `Glucose is trending high at ${Math.round(avgGlucose)} mg/dL.` : `Glucose is fairly steady at ${Math.round(avgGlucose)} mg/dL.`;

  return {
    summary: `${activityStatus} Intake is ${intakeStatus}. ${proteinStatus} ${glucoseStatus}`,
    recommendation: buildRecommendationText({
      avgSleep,
      avgSteps,
      avgBurn,
      avgIntake,
      avgProtein,
      avgCarbs,
      avgFats,
      avgGlucose,
      caloriesTarget,
    }),
    goalOutput: buildGoalOutputText({
      selectedGoal,
      avgSleep,
      avgSteps,
      avgBurn,
      avgIntake,
      avgProtein,
      avgCarbs,
      avgFats,
      avgGlucose,
      caloriesTarget,
    }),
  };
}

function buildRecommendationText({ avgSleep, avgSteps, avgBurn, avgIntake, avgProtein, avgCarbs, avgFats, avgGlucose, caloriesTarget }) {
  const parts = [];

  if (avgSteps < 7000) {
    parts.push(`raise activity with a 20-30 minute walk to push your average above 7,000 steps/day`);
  }

  if (avgIntake > caloriesTarget) {
    parts.push(`trim intake by about ${Math.round(avgIntake - caloriesTarget)} kcal or swap one snack for a protein-rich option`);
  } else if (avgIntake < caloriesTarget * 0.85) {
    parts.push(`add a balanced meal or protein snack so you do not under-fuel your day`);
  }

  if (avgProtein < 70) {
    parts.push(`increase protein by 20-30g/day to support recovery and satiety`);
  }

  if (avgGlucose > 110) {
    parts.push(`pair carbs with protein/fiber and keep your post-meal walks consistent to smooth glucose spikes`);
  }

  if (avgSleep < 7) {
    parts.push(`protect 7-8 hours of sleep; your recovery looks incomplete when sleep stays under 7 hours`);
  }

  if (parts.length === 0) {
    return `Your week looks balanced. Keep protein steady, maintain your step streak, and stay close to your calorie target.`;
  }

  return `This week, ${parts.join(". ")}.`;
}

function buildGoalOutputText({
  selectedGoal,
  avgSleep,
  avgSteps,
  avgBurn,
  avgIntake,
  avgProtein,
  avgCarbs,
  avgFats,
  avgGlucose,
  caloriesTarget,
}) {
  const goal = selectedGoal.replace(/\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim();

  if (goal === "Lose Weight") {
    return `To lose weight, keep intake around ${Math.max(0, Math.round(caloriesTarget - 150))}-${Math.round(caloriesTarget)} kcal, keep steps near ${Math.max(7000, Math.round(avgSteps))} per day, and hold protein at ${Math.max(80, Math.round(avgProtein))} g/day so you stay full.`;
  }

  if (goal === "Build Muscle") {
    return `To build muscle, aim for ${Math.max(90, Math.round(avgProtein + 20))} g protein/day, keep carbs available around training, and try to exceed ${Math.max(7500, Math.round(avgSteps))} steps with 2-3 focused strength sessions.`;
  }

  if (goal === "Improve Sleep") {
    return `To improve sleep, stop heavy meals 2-3 hours before bed, keep caffeine earlier in the day, and protect a 7-8 hour sleep window. Your current average is ${avgSleep.toFixed(1)} hours.`;
  }

  if (goal === "Eat Healthier") {
    return `To eat healthier, keep protein and fiber present at each meal, reduce days with high fat spikes, and keep glucose steadier by pairing carbs with protein.`;
  }

  if (goal === "Maintain Weight") {
    return `To maintain weight, keep intake within roughly ${Math.round(caloriesTarget * 0.95)}-${Math.round(caloriesTarget * 1.05)} kcal, keep steps around ${Math.round(avgSteps)} per day, and keep protein near ${Math.round(avgProtein)} g/day.`;
  }

  if (goal === "Improve Stamina") {
    return `To improve stamina, add one extra walk or cardio block on low-step days, keep sleep close to 7 hours, and avoid sharp calorie dips that leave you under-fueled.`;
  }

  if (goal === "Boost Energy") {
    return `To boost energy, spread carbs and protein more evenly through the day, keep hydration and sleep consistent, and avoid large calorie swings from one day to the next.`;
  }

  if (goal === "Stay Consistent") {
    return `To stay consistent, repeat the days where you hit good protein and step numbers, and keep your meals close to the same calorie range each day.`;
  }

  return `Your current average intake is ${Math.round(avgIntake)} kcal with ${Math.round(avgSteps).toLocaleString()} steps/day. Keep the trend moving in a steady, repeatable way.`;
}

export default function AiInsights({ user, goBack }) {
  const [selectedGoal, setSelectedGoal] = useState("Maintain Weight");
  const [recommendation, setRecommendation] = useState("Loading recommendation...");
  const [goalOutput, setGoalOutput] = useState("Loading goal output...");
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [trendsError, setTrendsError] = useState("");
  const [weeklySleep, setWeeklySleep] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [weeklySteps, setWeeklySteps] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyCaloriesBurnt, setWeeklyCaloriesBurnt] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyCaloriesIntake, setWeeklyCaloriesIntake] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyProtein, setWeeklyProtein] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyCarbs, setWeeklyCarbs] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyFats, setWeeklyFats] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyBloodGlucose, setWeeklyBloodGlucose] = useState([0, 0, 0, 0, 0, 0, 0]);

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
  const activityCards = useMemo(() => {
    const proteinIndex = getRandomIndexFromSeries(weeklyProtein, "high");
    const intakeIndex = getRandomIndexFromSeries(weeklyCaloriesIntake, "high");
    const burnIndex = getRandomIndexFromSeries(weeklyCaloriesBurnt, "high");
    const stepsIndex = getRandomIndexFromSeries(weeklySteps, "high");
    const glucoseIndex = getRandomIndexFromSeries(weeklyBloodGlucose, "low");
    const carbsIndex = getRandomIndexFromSeries(weeklyCarbs, "low");
    const fatsIndex = getRandomIndexFromSeries(weeklyFats, "low");
    const intakeScore = getSeriesScore(weeklyCaloriesIntake);

    return [
      {
        id: "protein",
        eyebrow: "Protein Highlight",
        title: `One of your stronger protein days was ${DAYS[proteinIndex]}`,
        value: `${Math.round(weeklyProtein[proteinIndex] || 0)} g`,
        note: "Pulled from your weekly Firestore logs.",
        chip: "bg-[linear-gradient(160deg,#4ea9ff,#3b7ed6)]",
        score: getSeriesScore(weeklyProtein),
      },
      {
        id: "calories-intake",
        eyebrow: "Intake Highlight",
        title: intakeScore > 0 ? `A notable intake day was ${DAYS[intakeIndex]}` : "No meal logs were found yet",
        value: intakeScore > 0 ? `${Math.round(weeklyCaloriesIntake[intakeIndex] || 0)} kcal` : "--",
        note: intakeScore > 0 ? "Randomized from your real meal log data." : "Add meal entries to unlock a Firestore-backed highlight.",
        chip: "bg-[linear-gradient(160deg,#f3a06f,#dc7b44)]",
        score: intakeScore,
      },
      {
        id: "calories-burn",
        eyebrow: "Burn Highlight",
        title: `A strong burn day landed on ${DAYS[burnIndex]}`,
        value: `${Math.round(weeklyCaloriesBurnt[burnIndex] || 0)} kcal`,
        note: "Based on the activity data saved in Firestore.",
        chip: "bg-[linear-gradient(160deg,#ff9f65,#d46c30)]",
        score: getSeriesScore(weeklyCaloriesBurnt),
      },
      {
        id: "steps",
        eyebrow: "Movement Highlight",
        title: `One of your more active days was ${DAYS[stepsIndex]}`,
        value: `${Math.round(weeklySteps[stepsIndex] || 0)} steps`,
        note: "Randomly selected from your weekly movement data.",
        chip: "bg-[linear-gradient(160deg,#49cfa7,#2f9f86)]",
        score: getSeriesScore(weeklySteps),
      },
      {
        id: "glucose",
        eyebrow: "Glucose Highlight",
        title: `One of your steadier glucose days was ${DAYS[glucoseIndex]}`,
        value: `${Math.round(weeklyBloodGlucose[glucoseIndex] || 0)} mg/dL`,
        note: "Pulled from the same Firestore context as Trends.",
        chip: "bg-[linear-gradient(160deg,#ef8ea8,#cb607a)]",
        score: Math.max(1, 1000 - getSeriesScore(weeklyBloodGlucose)),
      },
      {
        id: "low-carbs",
        eyebrow: "Low Carbs Day",
        title: `One of your lighter carb days was ${DAYS[carbsIndex]}`,
        value: `${Math.round(weeklyCarbs[carbsIndex] || 0)} g`,
        note: "Randomized from your nutrition history.",
        chip: "bg-[linear-gradient(160deg,#8fb4ff,#5f84d8)]",
        score: Math.max(1, 100 - getSeriesScore(weeklyCarbs)),
      },
      {
        id: "low-fats",
        eyebrow: "Low Fats Day",
        title: `One of your lighter fat days was ${DAYS[fatsIndex]}`,
        value: `${Math.round(weeklyFats[fatsIndex] || 0)} g`,
        note: "Picked from the same weekly database snapshot.",
        chip: "bg-[linear-gradient(160deg,#8dd0b0,#5ea285)]",
        score: Math.max(1, 100 - getSeriesScore(weeklyFats)),
      },
    ];
  }, [weeklyBloodGlucose, weeklyCaloriesBurnt, weeklyCaloriesIntake, weeklyProtein, weeklyCarbs, weeklyFats, weeklySteps]);

  const featuredActivityCardIndex = useMemo(() => getFeaturedCardIndex(activityCards), [activityCards]);
  const currentActivityCard = activityCards[featuredActivityCardIndex] || activityCards[0];

  const smartPlan = useMemo(
    () => buildSmartSummary({
      weeklySleep,
      weeklySteps,
      weeklyCaloriesBurnt,
      weeklyCaloriesIntake,
      weeklyProtein,
      weeklyCarbs,
      weeklyFats,
      weeklyBloodGlucose,
      caloriesTarget: user?.caloriesTarget || 2000,
      selectedGoal,
    }),
    [selectedGoal, user?.caloriesTarget, weeklyBloodGlucose, weeklyCaloriesBurnt, weeklyCaloriesIntake, weeklyCarbs, weeklyFats, weeklyProtein, weeklySleep, weeklySteps]
  );

 useEffect(() => {
  async function fetchInsights() {
    setIsLoadingInsights(true);
    setInsightsError("");
    try {
      const data = await apiFetch("/insights/", { method: "POST" });
      const fallbackRecommendation = data.explanation || data.recommendations?.[0] || "";
      const fallbackGoal = data.recommendations?.find(r => r.toLowerCase().includes(normalizedGoal.toLowerCase())) || data.recommendations?.[0] || "";

      setRecommendation(fallbackRecommendation || smartPlan.recommendation);
      setGoalOutput(fallbackGoal || smartPlan.goalOutput);
    } catch {
      setInsightsError("Backend insights unavailable right now.");
      setRecommendation(smartPlan.recommendation);
      setGoalOutput(smartPlan.goalOutput);
    } finally {
      setIsLoadingInsights(false);
    }
  }
  fetchInsights();
}, [normalizedGoal, smartPlan.goalOutput, smartPlan.recommendation]);

  useEffect(() => {
  async function fetchTrends() {
    setIsLoadingTrends(true);
    setTrendsError("");
    try {
      const data = await apiFetch("/health/weekly", { method: "GET" });
      const sleep = normalizeSeries(data.sleep || data.weeklySleep, weeklySleep);
      const steps = normalizeSeries(data.steps || data.weeklySteps, weeklySteps);
      const caloriesBurned = normalizeSeries(data.weeklyCaloriesBurned, weeklyCaloriesBurnt);
      const caloriesIntake = normalizeSeries(data.calories_intake || data.weeklyCaloriesIntake, weeklyCaloriesIntake);
      const protein = normalizeSeries(data.weeklyProtein, weeklyProtein);
      const carbs = normalizeSeries(data.weeklyCarbs, weeklyCarbs);
      const fats = normalizeSeries(data.weeklyFats, weeklyFats);
      const glucose = normalizeSeries(data.glucose || data.weeklyBloodGlucose, weeklyBloodGlucose);

      setWeeklySleep(prev => sleep);
      setWeeklySteps(prev => steps);
      setWeeklyCaloriesBurnt(prev => caloriesBurned);
      setWeeklyCaloriesIntake(prev => caloriesIntake);
      setWeeklyProtein(prev => protein);
      setWeeklyCarbs(prev => carbs);
      setWeeklyFats(prev => fats);
      setWeeklyBloodGlucose(prev => glucose);

      try {
        await apiFetch("/insights/trends-context", {
          method: "POST",
          body: JSON.stringify({
            dates: Array.isArray(data.dates) ? data.dates : [],
            sleep,
            steps,
            glucose,
            heart_rate: Array.isArray(data.heart_rate) ? data.heart_rate : Array.isArray(data.weeklyHeartRate) ? data.weeklyHeartRate : [],
            calories_intake: caloriesIntake,
            weeklyCaloriesBurned: caloriesBurned,
            weeklyProtein: protein,
            weeklyCarbs: carbs,
            weeklyFats: fats,
          }),
        });
      } catch {
        // Keep the UI working even if context storage fails.
      }
    } catch {
      setTrendsError("Trend highlights are using database defaults right now.");
      setRecommendation(smartPlan.recommendation);
      setGoalOutput(smartPlan.goalOutput);
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

          <div className="mt-3 rounded-[1rem] border border-[#cfd9e9] bg-white/75 px-4 py-3 text-sm leading-relaxed text-[#21324a] shadow-[0_8px_18px_rgba(31,43,64,0.08)]">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#466085]">Weekly Summary</p>
            <p className="mt-1">{smartPlan.summary}</p>
          </div>

          <div className="mt-3 rounded-[1.2rem] border border-white/30 bg-[linear-gradient(145deg,#1b273a,#27344a)] p-4 text-white shadow-[0_10px_22px_rgba(17,29,46,0.2)]">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-[#a7c1e4]">{currentActivityCard.eyebrow}</p>
            <p className="mt-2 text-[1.03rem] font-bold leading-[1.2]" style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>
              {currentActivityCard.title}
            </p>
            <p className={`mt-3 inline-block rounded-lg px-3 py-2 text-sm font-bold text-white ${currentActivityCard.chip}`}>
              {currentActivityCard.value}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#d6e4f8]">{currentActivityCard.note}</p>
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
