
import { motion } from "framer-motion";

export default function Home({ user }) {
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
          <button
            type="button"
            aria-label="Open profile"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/60 bg-[rgba(255,255,255,0.72)] text-[#1f3150] shadow-[0_8px_20px_rgba(31,43,64,0.16)]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 19c1.3-3.2 3.7-5 7-5s5.7 1.8 7 5" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Open menu"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#8ea2bf] bg-[rgba(255,255,255,0.68)] text-[#23334d] shadow-[0_8px_18px_rgba(31,43,64,0.15)]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
        </header>

        <div className="mb-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#3b4f6d]">Dashboard</p>
          <p
            className="mt-1 text-[1.5rem] font-semibold leading-[1.08] text-[#131722]"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            {user?.name ? `Welcome, ${user.name}` : "Welcome"}
          </p>
        </div>

        <main className="grid grid-cols-2 gap-3">
          <section className="row-span-2 min-h-[222px] rounded-[1.5rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] p-4 text-white shadow-[0_12px_26px_rgba(17,29,46,0.28)]">
            <div className="mb-5 grid place-items-center">
              <svg viewBox="0 0 120 62" className="h-16 w-full max-w-[176px]" fill="none" aria-hidden="true">
                <path
                  d="M12 50a48 48 0 0 1 96 0"
                  stroke="rgba(158,207,255,0.35)"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <path
                  d="M12 50a48 48 0 0 1 96 0"
                  stroke="#7ebeff"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray="72 230"
                />
              </svg>
            </div>
            <p
              className="-mt-12 mb-6 text-center text-[3rem] font-bold tracking-[-0.02em]"
              style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
            >
              36%
            </p>
            <div className="space-y-1 text-[0.98rem] font-semibold leading-tight text-[#e8efff]">
              <p>Height :</p>
              <p>Weight :</p>
              <p>BF% :</p>
            </div>
          </section>

          <section className="min-h-[104px] rounded-[1.25rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 py-3 text-white shadow-[0_12px_22px_rgba(17,29,46,0.26)]">
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
          </section>

          <section className="min-h-[104px] rounded-[1.25rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 py-3 text-white shadow-[0_12px_22px_rgba(17,29,46,0.26)]">
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
          </section>

          <section className="col-span-2 min-h-[106px] rounded-[1.35rem] border border-white/25 bg-[linear-gradient(145deg,#1b273a,#27344a)] px-4 py-3 text-white shadow-[0_12px_22px_rgba(17,29,46,0.26)]">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="7" width="18" height="13" rx="2" />
              <path d="M8 7l1.3-2h5.4L16 7" />
              <circle cx="12" cy="13.5" r="3.2" />
            </svg>
            <p
              className="mt-1 text-[1.7rem] font-bold leading-[1.02] tracking-[-0.01em]"
              style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
            >
              Prescription Insights
            </p>
          </section>
        </main>

        <div className="mt-auto rounded-[1rem] border border-[#a3b3cb] bg-[rgba(255,255,255,0.56)] px-3 py-2 shadow-[0_8px_20px_rgba(31,43,64,0.14)] backdrop-blur-[2px]">
          <div className="flex items-center justify-between text-[#3a4c68]">
            <button className="grid h-9 w-9 place-items-center rounded-[0.6rem] border border-[#6a7f9f] text-3xl leading-none text-[#21314a]">
              +
            </button>
            <span className="text-3xl">⌕</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
