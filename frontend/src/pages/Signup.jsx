import { useState } from "react";
import { motion } from "framer-motion";

function RowIcon({ type }) {
  if (type === "user") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c1.5-4 4.2-6 8-6s6.5 2 8 6" />
      </svg>
    );
  }

  if (type === "mail") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M4 7l8 6 8-6" />
      </svg>
    );
  }

  if (type === "lock") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }

  return null;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  );
}

function FormInput({ iconType, placeholder, type = "text", showEye, value, onChange, showPassword, onTogglePassword }) {
  const resolvedType = type === "password" ? (showPassword ? "text" : "password") : type;

  return (
    <div className="flex items-center rounded-full border border-[#b8c6da] bg-[rgba(255,255,255,0.78)] px-3 py-2 text-[#1b2638] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <span className="w-6 text-[#203049]">
        <RowIcon type={iconType} />
      </span>
      <input
        type={resolvedType}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="mx-2 w-full bg-transparent text-[1.05rem] font-semibold leading-none text-[#162339] outline-none placeholder:font-semibold placeholder:text-[#7f8ea8]"
      />
      <span className="flex w-6 justify-end text-[#203049]">
        {showEye ? (
          <button type="button" onClick={onTogglePassword} className="inline-flex" aria-label="Toggle password visibility">
            <EyeIcon />
          </button>
        ) : null}
      </span>
    </div>
  );
}

export default function Signup({ onContinue, goLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    setIsSubmitting(true);
    setError("");
    const result = await onContinue({ name, email, password, confirmPassword });
    if (!result.ok) {
      setError(result.error || "Signup failed.");
    }
    setIsSubmitting(false);
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-4 py-6 md:px-8 lg:px-10"
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
        className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1100px] items-center justify-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="w-full max-w-[360px] rounded-[2rem] border border-white/55 bg-[linear-gradient(150deg,rgba(255,255,255,0.88),rgba(250,252,255,0.56))] px-5 py-6 shadow-[0_18px_40px_rgba(36,44,57,0.16)] backdrop-blur-[5px] md:max-w-[460px] md:px-7 md:py-7"
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <p className="mb-2 text-center text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[#364152]">
            Get Started
          </p>
          <h2
            className="mb-5 text-center text-[2.2rem] font-bold leading-none text-[#131722]"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            Sign Up
          </h2>

          <div className="space-y-3">
            <FormInput
              iconType="user"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <FormInput
              iconType="mail"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FormInput
              iconType="lock"
              placeholder="Password"
              type="password"
              showEye
              value={password}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((prev) => !prev)}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FormInput
              iconType="lock"
              placeholder="Confirm"
              type="password"
              showEye
              value={confirmPassword}
              showPassword={showConfirmPassword}
              onTogglePassword={() => setShowConfirmPassword((prev) => !prev)}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error ? <p className="mt-2 text-center text-xs font-medium text-rose-600">{error}</p> : null}

          <motion.button
            onClick={handleContinue}
            disabled={isSubmitting}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            className="group relative mt-5 h-[58px] w-full overflow-hidden rounded-[1rem] border border-[#1f3f35] bg-[linear-gradient(160deg,#1f5a4b,#143c32)] px-5 text-[1.45rem] font-extrabold leading-none tracking-tight text-white shadow-[0_10px_24px_rgba(20,60,50,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ fontFamily: "'Space Grotesk', 'Sora', sans-serif" }}
          >
            <span className="absolute inset-x-0 top-0 h-px bg-white/40" />
            <span className="relative">{isSubmitting ? "Please wait..." : "Continue"}</span>
            <span className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-white/10 blur-xl transition-transform duration-300 group-hover:scale-125" />
          </motion.button>

          <button
            type="button"
            onClick={goLogin}
            className="mt-3 w-full text-center text-sm font-semibold text-[#2f415f] underline-offset-2 hover:underline"
          >
            Already have an account?
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
