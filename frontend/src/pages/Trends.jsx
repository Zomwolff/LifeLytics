import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../api/client";

function WeeklyBarChart({ title, unit, values, labels, maxValue, colorClass, target, weeklyAverage, valueFormatter }) {
  const fallbackLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const resolvedLabels = Array.isArray(labels) && labels.length === 7 ? labels : fallbackLabels;
  const formatValue = typeof valueFormatter === "function" ? valueFormatter : (value) => String(value);

  return (
    <section className="rounded-[1.25rem] border border-white/30 bg-[rgba(255,255,255,0.62)] p-4 shadow-[0_10px_22px_rgba(31,43,64,0.14)]">
      <div className="mb-3 flex items-end justify-between gap-2">
        <p className="text-sm font-semibold text-[#2b4467]">{title}</p>
        <div className="flex items-center gap-2">
          <p className="text-[0.68rem] font-semibold text-[#4e6486]">Avg: {weeklyAverage}</p>
          {target !== undefined && <p className="text-[0.68rem] font-semibold text-[#4e6486]">Target: {target}</p>}
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#4e6486]">Weekly</p>
        </div>
      </div>

      <div className="grid h-48 grid-cols-7 items-end gap-1 rounded-xl border border-[#c8d5e6] bg-[linear-gradient(180deg,rgba(238,244,252,0.85),rgba(225,235,248,0.88))] px-2 py-3">
        {values.map((value, index) => {
          const ratio = maxValue > 0 ? Math.min(Math.max(value / maxValue, 0), 1) : 0;
          const barHeight = `${Math.max(ratio * 100, 8)}%`;
          const formattedValue = formatValue(value);

          return (
            <div key={`${title}-${resolvedLabels[index]}`} className="group flex h-full min-w-0 flex-col items-center justify-end gap-1">
              <div className="pointer-events-none h-4 w-full text-center">
                <span className="inline-block rounded-md bg-[#1f3656] px-1.5 py-0.5 text-[0.6rem] font-bold leading-none text-white opacity-0 transition-all duration-150 group-hover:-translate-y-0.5 group-hover:opacity-100">
                  {formattedValue}
                </span>
              </div>
              <div className="flex h-28 w-full items-end rounded-md bg-white/55 p-[2px]">
                <motion.div
                  className={`w-full rounded-sm ${colorClass}`}
                  style={{ height: barHeight }}
                  whileHover={{ scale: 1.06 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18 }}
                />
              </div>
              <div className="w-full truncate text-center text-[0.62rem] font-semibold leading-none text-[#4e6486]">
                {resolvedLabels[index]}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[0.72rem] font-medium text-[#4d6382]">Unit: {unit}</p>
    </section>
  );
}

function normalizeSeries(series, fallback) {
  if (!Array.isArray(series) || series.length !== 7) return fallback;
  const parsed = series.map((value) => Number(value));
  return parsed.every((value) => Number.isFinite(value)) ? parsed : fallback;
}

function formatDateLabel(dateString) {
  if (typeof dateString !== "string" || !dateString) return "";

  const parsedDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return dateString;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsedDate);
}

export default function Trends({ user, goBack }) {
  const fallbackSleep = [0, 0, 0, 0, 0, 0, 0];
  const fallbackSteps = [0, 0, 0, 0, 0, 0, 0];
  const fallbackCaloriesIntake = [0, 0, 0, 0, 0, 0, 0];
  const fallbackCaloriesBurned = [0, 0, 0, 0, 0, 0, 0];
  const fallbackBloodGlucose = [0, 0, 0, 0, 0, 0, 0];

  const [weeklySleep, setWeeklySleep] = useState(fallbackSleep);
  const [weeklySteps, setWeeklySteps] = useState(fallbackSteps);
  const [weeklyCaloriesIntake, setWeeklyCaloriesIntake] = useState(fallbackCaloriesIntake);
  const [weeklyCaloriesBurned, setWeeklyCaloriesBurned] = useState(fallbackCaloriesBurned);
  const [weeklyBloodGlucose, setWeeklyBloodGlucose] = useState(fallbackBloodGlucose);
  const [weeklyDates, setWeeklyDates] = useState([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [trendsError, setTrendsError] = useState("");

  const avgSleep = (weeklySleep.reduce((a, b) => a + b, 0) / weeklySleep.length).toFixed(1);
  const totalSteps = weeklySteps.reduce((a, b) => a + b, 0);
  const avgSteps = (totalSteps / weeklySteps.length).toFixed(0);
  const avgCalories = (weeklyCaloriesIntake.reduce((a, b) => a + b, 0) / weeklyCaloriesIntake.length).toFixed(0);
  const avgCaloriesBurned = (weeklyCaloriesBurned.reduce((a, b) => a + b, 0) / weeklyCaloriesBurned.length).toFixed(0);
  const avgGlucose = (weeklyBloodGlucose.reduce((a, b) => a + b, 0) / weeklyBloodGlucose.length).toFixed(0);
  const weeklyLabels = weeklyDates.map(formatDateLabel);

  useEffect(() => {
    async function fetchWeeklyTrends() {
      setIsLoadingTrends(true);
      setTrendsError("");

      try {
        const data = await apiFetch("/health/weekly", { method: "GET" });
        const dates = Array.isArray(data.dates) ? data.dates : [];
        const sleep = normalizeSeries(data.sleep || data.weeklySleep, fallbackSleep);
        const steps = normalizeSeries(data.steps || data.weeklySteps, fallbackSteps);
        const caloriesIntake = normalizeSeries(data.calories_intake || data.weeklyCaloriesIntake, fallbackCaloriesIntake);
        const caloriesBurned = normalizeSeries(data.weeklyCaloriesBurned, fallbackCaloriesBurned);
        const glucose = normalizeSeries(data.glucose || data.weeklyBloodGlucose, fallbackBloodGlucose);

        setWeeklyDates(dates);
        setWeeklySleep(sleep);
        setWeeklySteps(steps);
        setWeeklyCaloriesIntake(caloriesIntake);
        setWeeklyCaloriesBurned(caloriesBurned);
        setWeeklyBloodGlucose(glucose);

        try {
          await apiFetch("/insights/trends-context", {
            method: "POST",
            body: JSON.stringify({
              dates,
              sleep,
              steps,
              glucose,
              heart_rate: Array.isArray(data.heart_rate) ? data.heart_rate : Array.isArray(data.weeklyHeartRate) ? data.weeklyHeartRate : [],
              calories_intake: caloriesIntake,
              weeklyCaloriesBurned: caloriesBurned,
              weeklyProtein: Array.isArray(data.weeklyProtein) ? data.weeklyProtein : [],
              weeklyCarbs: Array.isArray(data.weeklyCarbs) ? data.weeklyCarbs : [],
              weeklyFats: Array.isArray(data.weeklyFats) ? data.weeklyFats : [],
            }),
          });
        } catch {
          // If context save fails, charts still render from fetched weekly data.
        }
      } catch {
        setTrendsError("Backend trends unavailable right now. Showing database default values.");
      } finally {
        setIsLoadingTrends(false);
      }
    }

    fetchWeeklyTrends();

    const interval = setInterval(fetchWeeklyTrends, 60 * 1000);
    const onFocus = () => fetchWeeklyTrends();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchWeeklyTrends();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user?.id]);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6 md:px-8 lg:px-10"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#71bcff_0%,rgba(113,188,255,0.32)_56%,transparent_100%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#69dcb0_0%,rgba(105,220,176,0.28)_56%,transparent_100%)] blur-2xl" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[1100px] flex-col sm:min-h-[calc(100vh-3rem)]"
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
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#3b4f6d]">Trends</p>
        </header>

        <div className="mb-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#3b4f6d]">Health Analytics</p>
          <p
            className="mt-1 text-[1.5rem] font-semibold leading-[1.08] text-[#131722]"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            Week Summary: {avgSleep}h sleep • {avgSteps.toLocaleString()} steps/day • {avgCalories} kcal/day
          </p>
        </div>

        <main className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {isLoadingTrends ? <p className="text-xs font-semibold text-[#3b4f6d]">Loading weekly trends...</p> : null}
          {trendsError ? <p className="text-xs font-semibold text-[#9e2f2f]">{trendsError}</p> : null}

          <WeeklyBarChart
            title="Sleep"
            unit="hours"
            values={weeklySleep}
            labels={weeklyLabels}
            maxValue={10}
            colorClass="bg-[linear-gradient(180deg,#6c8dff,#4f6de3)]"
            weeklyAverage={avgSleep}
            valueFormatter={(value) => Number(value).toFixed(1)}
          />

          <WeeklyBarChart
            title="Steps"
            unit="steps"
            values={weeklySteps}
            labels={weeklyLabels}
            maxValue={12000}
            colorClass="bg-[linear-gradient(180deg,#53dcb2,#2db791)]"
            weeklyAverage={avgSteps.toLocaleString()}
            valueFormatter={(value) => Math.round(Number(value)).toLocaleString()}
          />

          <WeeklyBarChart
            title="Calorie Intake"
            unit="kcal"
            values={weeklyCaloriesIntake}
            labels={weeklyLabels}
            maxValue={Math.max(Number.isFinite(user?.caloriesTarget) ? user.caloriesTarget * 1.2 : 2400, 2400)}
            colorClass="bg-[linear-gradient(180deg,#ffb17f,#f1884e)]"
            target={user?.caloriesTarget || 2000}
            weeklyAverage={avgCalories}
            valueFormatter={(value) => Math.round(Number(value)).toLocaleString()}
          />

          <WeeklyBarChart
            title="Calories Burned"
            unit="kcal"
            values={weeklyCaloriesBurned}
            labels={weeklyLabels}
            maxValue={Math.max(...weeklyCaloriesBurned, 1)}
            colorClass="bg-[linear-gradient(180deg,#76d6ff,#3da3e6)]"
            weeklyAverage={avgCaloriesBurned}
            valueFormatter={(value) => Math.round(Number(value)).toLocaleString()}
          />

          <WeeklyBarChart
            title="Blood Glucose Levels"
            unit="mg/dL"
            values={weeklyBloodGlucose}
            labels={weeklyLabels}
            maxValue={180}
            colorClass="bg-[linear-gradient(180deg,#f48aa0,#d75a78)]"
            weeklyAverage={avgGlucose}
            valueFormatter={(value) => Math.round(Number(value)).toLocaleString()}
          />
        </main>
      </motion.div>
    </div>
  );
}
