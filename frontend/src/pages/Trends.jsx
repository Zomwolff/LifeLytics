import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../api/client";

function WeeklyBarChart({ title, unit, values, maxValue, colorClass }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <section className="rounded-[1.25rem] border border-white/30 bg-[rgba(255,255,255,0.62)] p-4 shadow-[0_10px_22px_rgba(31,43,64,0.14)]">
      <div className="mb-3 flex items-end justify-between gap-2">
        <p className="text-sm font-semibold text-[#2b4467]">{title}</p>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#4e6486]">Weekly</p>
      </div>

      <div className="grid h-40 grid-cols-7 items-end gap-2 rounded-xl border border-[#c8d5e6] bg-[linear-gradient(180deg,rgba(238,244,252,0.85),rgba(225,235,248,0.88))] px-2 py-3">
        {values.map((value, index) => {
          const ratio = maxValue > 0 ? Math.min(Math.max(value / maxValue, 0), 1) : 0;
          const barHeight = `${Math.max(ratio * 100, 8)}%`;

          return (
            <div key={`${title}-${days[index]}`} className="flex h-full flex-col items-center justify-end gap-1">
              <div className="text-[0.62rem] font-semibold text-[#48607e]">{value}</div>
              <div className="flex h-28 w-full items-end rounded-md bg-white/55 p-[2px]">
                <div className={`w-full rounded-sm ${colorClass}`} style={{ height: barHeight }} />
              </div>
              <div className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#4e6486]">{days[index]}</div>
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

function sumSeries(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== 7 || right.length !== 7) {
    return null;
  }

  const result = left.map((value, index) => Number(value) + Number(right[index]));
  return result.every((value) => Number.isFinite(value)) ? result : null;
}

export default function Trends({ user, goBack }) {
  const fallbackSleep = [6.5, 7.1, 6.8, 7.4, 7.0, 8.0, 7.6];
  const fallbackSteps = [6100, 7400, 6900, 8200, 9100, 10200, 8800];
  const fallbackCaloriesBurnt = [1940, 2025, 1982, 2080, 2154, 2210, 2117];
  const fallbackBloodGlucose = [102, 110, 106, 98, 104, 100, 96];

  const [weeklySleep, setWeeklySleep] = useState(fallbackSleep);
  const [weeklySteps, setWeeklySteps] = useState(fallbackSteps);
  const [weeklyCaloriesBurnt, setWeeklyCaloriesBurnt] = useState(fallbackCaloriesBurnt);
  const [weeklyBloodGlucose, setWeeklyBloodGlucose] = useState(fallbackBloodGlucose);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [trendsError, setTrendsError] = useState("");


  useEffect(() => {
    async function fetchWeeklyTrends() {
      setIsLoadingTrends(true);
      setTrendsError("");

      try {
        const data = await apiFetch("/health/trends", { method: "GET" });
        setWeeklySleep(normalizeSeries(data.weeklySleep, fallbackSleep));
        setWeeklySteps(normalizeSeries(data.weeklySteps, fallbackSteps));
        setWeeklyCaloriesBurnt((previous) => {
          const normalizedTotal = normalizeSeries(data.weeklyTotalCaloriesBurnt, previous);
          if (normalizedTotal !== previous) {
            return normalizedTotal;
          }

          const fromComponents = sumSeries(data.weeklyActiveCaloriesBurnt, data.weeklyRestingCaloriesBurnt);
          if (fromComponents) {
            return fromComponents;
          }

          return normalizeSeries(data.weeklyCaloriesBurnt, previous);
        });
        setWeeklyBloodGlucose(normalizeSeries(data.weeklyBloodGlucose, fallbackBloodGlucose));
      } catch {
        setTrendsError("Backend trends unavailable right now. Showing latest cached-style values.");
      } finally {
        setIsLoadingTrends(false);
      }
    }

    fetchWeeklyTrends();
  }, [trendsEndpoint, user?.id]);

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-4 py-6 md:px-8 lg:px-10"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#71bcff_0%,rgba(113,188,255,0.32)_56%,transparent_100%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#69dcb0_0%,rgba(105,220,176,0.28)_56%,transparent_100%)] blur-2xl" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1100px] flex-col"
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
            Weekly Graphs
          </p>
        </div>

        <main className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {isLoadingTrends ? <p className="text-xs font-semibold text-[#3b4f6d]">Loading weekly trends...</p> : null}
          {trendsError ? <p className="text-xs font-semibold text-[#9e2f2f]">{trendsError}</p> : null}

          <WeeklyBarChart
            title="Sleep"
            unit="hours"
            values={weeklySleep}
            maxValue={10}
            colorClass="bg-[linear-gradient(180deg,#6c8dff,#4f6de3)]"
          />

          <WeeklyBarChart
            title="Steps"
            unit="steps"
            values={weeklySteps}
            maxValue={12000}
            colorClass="bg-[linear-gradient(180deg,#53dcb2,#2db791)]"
          />

          <WeeklyBarChart
            title="Total Calories Burnt"
            unit="kcal"
            values={weeklyCaloriesBurnt}
            maxValue={3000}
            colorClass="bg-[linear-gradient(180deg,#ffb17f,#f1884e)]"
          />

          <WeeklyBarChart
            title="Blood Glucose Levels"
            unit="mg/dL"
            values={weeklyBloodGlucose}
            maxValue={180}
            colorClass="bg-[linear-gradient(180deg,#f48aa0,#d75a78)]"
          />
        </main>
      </motion.div>
    </div>
  );
}
