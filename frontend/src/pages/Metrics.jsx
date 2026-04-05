import { useState } from "react";
import { motion } from "framer-motion";

export default function Metrics({ user, goHome, goChat, goMetrics, goProfile, onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const bmi = Number.isFinite(user?.heightCm) && Number.isFinite(user?.weightKg)
    ? user.weightKg / ((user.heightCm / 100) * (user.heightCm / 100))
    : null;
  const bmiProgress = bmi ? Math.min(Math.max(bmi / 40, 0), 1) : 0;
  const bmiArcColor = !bmi ? "#7ebeff" : bmi < 18.5 ? "#7ebeff" : bmi <= 24.9 ? "#6de1a7" : bmi <= 29.9 ? "#f6c96f" : "#f08a8a";

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-4 py-6"
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
        className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[430px] flex-col"
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
              onClick={() => {
                setIsProfileMenuOpen(false);
                setIsMenuOpen((prev) => !prev);
              }}
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
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#3b4f6d]">Body Metrics</p>
            <p className="mt-1 text-[1.5rem] font-semibold leading-[1.08] text-[#131722]" style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>
              {user?.name ? `${user.name}'s Progress` : "Your Progress"}
            </p>
          </div>
        </div>

        <main className="space-y-3">
          <section className="rounded-[1.5rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] p-4 text-white shadow-[0_12px_26px_rgba(17,29,46,0.28)]">
            <div className="mb-4 grid place-items-center">
              <svg viewBox="0 0 120 62" className="h-16 w-full max-w-[176px]" fill="none" aria-hidden="true">
                <path d="M12 50a48 48 0 0 1 96 0" stroke="rgba(158,207,255,0.35)" strokeWidth="7" strokeLinecap="round" />
                <path
                  d="M12 50a48 48 0 0 1 96 0"
                  stroke={bmiArcColor}
                  strokeWidth="7"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={`${(bmiProgress * 100).toFixed(1)} 100`}
                />
              </svg>
            </div>
            <p className="-mt-10 mb-4 text-center text-[2.8rem] font-bold tracking-[-0.02em]" style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}>
              {bmi ? bmi.toFixed(1) : "--"}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/10 px-2 py-2">
                <p className="text-[0.65rem] uppercase tracking-[0.14em] text-[#a9c3e8]">Height</p>
                <p className="mt-1 text-sm font-semibold">{Number.isFinite(user?.heightCm) ? `${user.heightCm} cm` : "-"}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-2 py-2">
                <p className="text-[0.65rem] uppercase tracking-[0.14em] text-[#a9c3e8]">Weight</p>
                <p className="mt-1 text-sm font-semibold">{Number.isFinite(user?.weightKg) ? `${user.weightKg} kg` : "-"}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-2 py-2">
                <p className="text-[0.65rem] uppercase tracking-[0.14em] text-[#a9c3e8]">BMI</p>
                <p className="mt-1 text-sm font-semibold">{bmi ? bmi.toFixed(1) : "-"}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.25rem] border border-white/30 bg-[rgba(255,255,255,0.58)] px-4 py-3 text-[#1a2b43] shadow-[0_10px_22px_rgba(31,43,64,0.14)]">
            <p className="text-sm font-semibold text-[#2b4467]">Latest Entries</p>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2">
                <span>2026-04-05</span>
                <span>72 kg | BMI 23.5</span>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2">
                <span>2026-03-29</span>
                <span>72.6 kg | BMI 23.7</span>
              </li>
            </ul>
          </section>
        </main>

        <div className="mt-auto">
          <button
            type="button"
            onClick={goChat}
            className="w-full rounded-[1rem] border border-[#a3b3cb] bg-[rgba(255,255,255,0.56)] px-3 py-2 text-left shadow-[0_8px_20px_rgba(31,43,64,0.14)] backdrop-blur-[2px]"
          >
            <div className="flex items-center gap-2 text-[#3a4c68]">
              <span className="grid h-9 w-9 place-items-center rounded-[0.6rem] border border-[#6a7f9f] text-3xl leading-none text-[#21314a]">+</span>
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
    </div>
  );
}
