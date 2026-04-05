import { useState } from "react";
import { motion } from "framer-motion";

export default function SetupMetrics({ user, onContinue }) {
  const [heightCm, setHeightCm] = useState(user?.heightCm ? String(user.heightCm) : "");
  const [weightKg, setWeightKg] = useState(user?.weightKg ? String(user.weightKg) : "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    const result = await onContinue({ heightCm, weightKg });
    if (!result.ok) {
      setError(result.error || "Could not save your metrics.");
    }
    setIsSaving(false);
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-4 py-6"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#71bcff_0%,rgba(113,188,255,0.32)_56%,transparent_100%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#69dcb0_0%,rgba(105,220,176,0.28)_56%,transparent_100%)] blur-2xl" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[430px] items-center justify-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.form
          onSubmit={handleSave}
          className="w-full max-w-[360px] rounded-[2rem] border border-white/55 bg-[linear-gradient(150deg,rgba(255,255,255,0.88),rgba(250,252,255,0.56))] px-5 py-6 shadow-[0_18px_40px_rgba(36,44,57,0.16)] backdrop-blur-[5px]"
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <p className="mb-2 text-center text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#364152]">
            Quick Setup
          </p>
          <h2
            className="mb-3 text-center text-[2rem] font-bold leading-none text-[#131722]"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            Enter Your Metrics
          </h2>
          <p className="mb-5 text-center text-sm font-medium text-[#3e516f]">
            This helps personalize your dashboard and insights.
          </p>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#435675]">Height (cm)</span>
              <input
                type="number"
                min="80"
                max="260"
                step="0.1"
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                placeholder="e.g. 175"
                className="h-11 w-full rounded-[0.85rem] border border-[#b8c6da] bg-[rgba(255,255,255,0.78)] px-3 text-base font-semibold text-[#162339] outline-none placeholder:text-[#7f8ea8]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[#435675]">Weight (kg)</span>
              <input
                type="number"
                min="20"
                max="400"
                step="0.1"
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
                placeholder="e.g. 72"
                className="h-11 w-full rounded-[0.85rem] border border-[#b8c6da] bg-[rgba(255,255,255,0.78)] px-3 text-base font-semibold text-[#162339] outline-none placeholder:text-[#7f8ea8]"
              />
            </label>
          </div>

          {error ? <p className="mt-3 text-center text-xs font-semibold text-rose-600">{error}</p> : null}

          <motion.button
            type="submit"
            disabled={isSaving}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            className="group relative mt-5 h-[58px] w-full overflow-hidden rounded-[1rem] border border-[#1f3f35] bg-[linear-gradient(160deg,#1f5a4b,#143c32)] px-5 text-[1.2rem] font-extrabold leading-none tracking-tight text-white shadow-[0_10px_24px_rgba(20,60,50,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            <span className="absolute inset-x-0 top-0 h-px bg-white/40" />
            <span className="relative">{isSaving ? "Saving..." : "Continue"}</span>
            <span className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-white/10 blur-xl transition-transform duration-300 group-hover:scale-125" />
          </motion.button>
        </motion.form>
      </motion.div>
    </div>
  );
}
