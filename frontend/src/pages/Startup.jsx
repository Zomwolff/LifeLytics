import { motion } from "framer-motion";

export default function Startup({ goLogin, goSignup }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-3 py-4 sm:px-4 sm:py-6 md:px-8 lg:px-10"
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
        className="relative z-10 mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[1100px] items-center justify-center sm:min-h-[calc(100vh-3rem)]"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="w-full max-w-[440px] rounded-[1.65rem] border border-white/55 bg-[linear-gradient(150deg,rgba(255,255,255,0.88),rgba(250,252,255,0.56))] px-4 py-5 shadow-[0_18px_40px_rgba(36,44,57,0.16)] backdrop-blur-[5px] sm:rounded-[2rem] sm:px-5 sm:py-6 md:px-7 md:py-7"
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <p className="mb-2 text-center text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#364152]">
            LifeLytics
          </p>
          <h1
            className="mx-auto max-w-[330px] text-center text-[clamp(1.95rem,8vw,2.35rem)] font-bold leading-[1.05] text-[#131722]"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            Shape your body goals with calm precision.
          </h1>
          <p className="mx-auto mt-3 max-w-[330px] text-center text-[0.98rem] leading-relaxed text-[#4b566a] sm:text-[1rem]">
            Track wellness, learn from AI insights, and stay consistent with a dashboard built for everyday momentum.
          </p>

          <motion.div
            className="mt-5 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
          <motion.button
            onClick={goLogin}
            whileHover={{ y: -3, scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            className="group relative h-14 w-full overflow-hidden rounded-[1rem] border border-[#283447] bg-[linear-gradient(160deg,#1f2c40,#131a26)] px-4 text-[1.3rem] font-extrabold leading-none tracking-tight text-white shadow-[0_10px_24px_rgba(16,26,43,0.35)] sm:h-[66px] sm:text-[1.45rem]"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            <span className="absolute inset-x-0 top-0 h-px bg-white/40" />
            <span className="relative">Login</span>
            <span className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-white/10 blur-xl transition-transform duration-300 group-hover:scale-125" />
          </motion.button>

          <motion.button
            onClick={goSignup}
            whileHover={{ y: -3, scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            className="group relative h-14 w-full overflow-hidden rounded-[1rem] border border-[#1f3f35] bg-[linear-gradient(160deg,#1f5a4b,#143c32)] px-4 text-[1.3rem] font-extrabold leading-none tracking-tight text-white shadow-[0_10px_24px_rgba(20,60,50,0.3)] sm:h-[66px] sm:text-[1.45rem]"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            <span className="absolute inset-x-0 top-0 h-px bg-white/40" />
            <span className="relative">Sign Up</span>
            <span className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-white/10 blur-xl transition-transform duration-300 group-hover:scale-125" />
          </motion.button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
