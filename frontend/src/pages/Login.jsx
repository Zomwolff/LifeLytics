
import { useState } from "react";

function RowIcon({ type }) {
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
    <div className="flex items-center rounded-full bg-[#ececec] px-3 py-1.5 text-[#14161a]">
      <span className="w-6 text-[#1f2024]">
        <RowIcon type={iconType} />
      </span>
      <input
        type={resolvedType}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="mx-2 w-full bg-transparent text-center text-xl font-bold leading-none text-[#15161a] outline-none placeholder:font-semibold placeholder:text-[#bfc0c6]"
      />
      <span className="flex w-6 justify-end text-[#1f2024]">
        {showEye ? (
          <button type="button" onClick={onTogglePassword} className="inline-flex" aria-label="Toggle password visibility">
            <EyeIcon />
          </button>
        ) : null}
      </span>
    </div>
  );
}

export default function Login({ onContinue, goSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    setIsSubmitting(true);
    setError("");
    const result = await onContinue({ email, password });
    if (!result.ok) {
      setError(result.error || "Login failed.");
    }
    setIsSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-[#ececed] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[360px] flex-col items-center justify-center pb-10">
        <div className="mb-2 flex items-end justify-center gap-2">
          <img src="/avatars/5.png" alt="avatar one" className="h-24 w-24 object-contain" />
          <img src="/avatars/2.png" alt="avatar two" className="h-24 w-24 object-contain" />
        </div>

        <div className="w-full max-w-[270px] rounded-[1.2rem] bg-[#202126] p-4 text-white shadow-[0_12px_26px_rgba(15,23,42,0.24)]">
          <h2 className="mb-4 text-center text-4xl font-extrabold tracking-tight">Login</h2>
          <div className="space-y-3">
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
          </div>

          {error ? <p className="mt-2 text-center text-xs text-rose-300">{error}</p> : null}

          <button
            onClick={handleContinue}
            disabled={isSubmitting}
            className="mx-auto mt-5 block rounded-full bg-[#ececec] px-10 py-1 text-xl font-bold text-[#1a1a1a] disabled:opacity-60"
          >
            {isSubmitting ? "Please wait..." : "Continue"}
          </button>

          <p onClick={goSignup} className="mt-3 cursor-pointer text-center text-xs text-white/80">
            New user? Sign Up
          </p>
        </div>
      </div>
    </div>
  );
}
