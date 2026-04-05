import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

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

export default function AiInsights({ user, goBack }) {
  const [selectedGoal, setSelectedGoal] = useState("Maintain Weight");
  const [recommendation, setRecommendation] = useState("Loading recommendation...");
  const [goalOutput, setGoalOutput] = useState("Loading goal output...");
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [avgDailySteps, setAvgDailySteps] = useState(null);
  const [avgDailyCaloriesBurnt, setAvgDailyCaloriesBurnt] = useState(null);

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
  const stepsProgress = Number.isFinite(avgDailySteps) ? Math.min(Math.max(avgDailySteps / 12000, 0), 1) : 0;
  const caloriesBurntProgress = Number.isFinite(avgDailyCaloriesBurnt) ? Math.min(Math.max(avgDailyCaloriesBurnt / 1000, 0), 1) : 0;

  const normalizedGoal = useMemo(
    () => selectedGoal.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim(),
    [selectedGoal]
  );

  const aiInsightsEndpoint = import.meta.env.VITE_AI_INSIGHTS_ENDPOINT || "/api/ai-insights";

  useEffect(() => {
    async function fetchInsights() {
      setIsLoadingInsights(true);
      setInsightsError("");

      try {
        const response = await fetch(aiInsightsEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user?.id ?? null,
            name: user?.name ?? null,
            age: user?.age ?? null,
            gender: user?.gender ?? null,
            heightCm: heightValue,
            weightKg: weightValue,
            bmi,
            selectedGoal: normalizedGoal,
          }),
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        setRecommendation(data.recommendation || "No recommendation returned by backend.");
        setGoalOutput(data.goalOutput || "No goal output returned by backend.");
        setAvgDailySteps(Number.isFinite(data.avgDailySteps) ? data.avgDailySteps : null);
        setAvgDailyCaloriesBurnt(Number.isFinite(data.avgDailyCaloriesBurnt) ? data.avgDailyCaloriesBurnt : null);
      } catch {
        setInsightsError("Backend insights unavailable right now.");
        setRecommendation("No recommendation available. Connect backend endpoint to load personalized insights.");
        setGoalOutput("No goal output available. Connect backend endpoint to load goal-specific advice.");
        setAvgDailySteps(null);
        setAvgDailyCaloriesBurnt(null);
      } finally {
        setIsLoadingInsights(false);
      }
    }

    fetchInsights();
  }, [aiInsightsEndpoint, bmi, heightValue, normalizedGoal, user?.age, user?.gender, user?.id, user?.name, weightValue]);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-4 py-6"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#71bcff_0%,rgba(113,188,255,0.32)_56%,transparent_100%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#69dcb0_0%,rgba(105,220,176,0.28)_56%,transparent_100%)] blur-2xl" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[430px] flex-col"
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

        <section className="rounded-[1.4rem] border border-white/35 bg-[rgba(255,255,255,0.62)] p-4 shadow-[0_10px_22px_rgba(31,43,64,0.14)]">
          <p className="text-sm font-semibold text-[#2b4467]">Current Snapshot</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <CircularMetric label="BMI" value={bmi} suffix="" progress={bmiProgress} color="#4ea9ff" />
            <CircularMetric label="Height" value={heightValue} suffix="cm" progress={heightProgress} color="#4dd7a6" />
            <CircularMetric label="Weight" value={weightValue} suffix="kg" progress={weightProgress} color="#9b8cff" />
          </div>
        </section>

        <section className="mt-3 rounded-[1.4rem] border border-white/35 bg-[rgba(255,255,255,0.62)] p-4 shadow-[0_10px_22px_rgba(31,43,64,0.14)]">
          <p className="text-sm font-semibold text-[#2b4467]">Daily Activity Snapshot</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <CircularMetric
              label="Avg Daily Steps"
              value={avgDailySteps}
              suffix="steps"
              progress={stepsProgress}
              color="#5a9ef8"
            />
            <CircularMetric
              label="Avg Daily Calories Burnt"
              value={avgDailyCaloriesBurnt}
              suffix="kcal"
              progress={caloriesBurntProgress}
              color="#f68f6f"
            />
          </div>
        </section>

        <section className="mt-3 rounded-[1.4rem] border border-white/30 bg-[linear-gradient(145deg,#1b273a,#27344a)] p-4 text-white shadow-[0_12px_26px_rgba(17,29,46,0.28)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#aac4e7]">Recommendation</p>
          <p className="mt-2 text-[0.98rem] leading-relaxed">{isLoadingInsights ? "Loading recommendation..." : recommendation}</p>
          {insightsError ? <p className="mt-2 text-xs font-semibold text-amber-300">{insightsError}</p> : null}
        </section>

        <section className="mt-3 rounded-[1.25rem] border border-white/35 bg-[rgba(255,255,255,0.62)] p-4 shadow-[0_10px_22px_rgba(31,43,64,0.14)]">
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
