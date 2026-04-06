import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

const BASE = import.meta.env.VITE_API_URL || "";

// ── helpers ───────────────────────────────────────────────────────────────────

async function getToken() {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function toSafeUser(profile) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    age: profile.age ?? null,
    gender: profile.gender ?? null,
    heightCm: profile.heightCm ?? null,
    weightKg: profile.weightKg ?? null,
    targetSteps: profile.targetSteps ?? null,
    caloriesTarget: profile.caloriesTarget ?? null,
  };
}

// ── auth functions ────────────────────────────────────────────────────────────

export async function registerUser({ name, email, password, confirmPassword }) {
  const cleanName = name.trim();
  const cleanEmail = normalizeEmail(email);

  if (!cleanName) return { ok: false, error: "Name is required." };
  if (!cleanEmail || !cleanEmail.includes("@")) return { ok: false, error: "Enter a valid email." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { ok: false, error: "Passwords do not match." };

  try {
    await createUserWithEmailAndPassword(auth, cleanEmail, password);
    // Firebase signed in — token now available
    const profile = await apiFetch("/users/profile", {
      method: "POST",
      body: JSON.stringify({ name: cleanName, email: cleanEmail }),
    });
    return { ok: true, user: toSafeUser(profile) };
  } catch (err) {
    // Roll back Firebase user if Firestore profile creation failed
    if (auth.currentUser) {
      await auth.currentUser.delete().catch(() => {});
    }
    const msg =
      err.code === "auth/email-already-in-use"
        ? "An account with this email already exists."
        : err.message;
    return { ok: false, error: msg };
  }
}

export async function loginUser({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  try {
    await signInWithEmailAndPassword(auth, cleanEmail, password);
    const profile = await apiFetch("/users/profile");
    return { ok: true, user: toSafeUser(profile) };
  } catch (err) {
    if (err.message === "Profile not found") {
      return { ok: false, error: "No profile found. Please sign up again." };
    }
    const msg =
      err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
        ? "Incorrect email or password."
        : err.code === "auth/user-not-found"
        ? "No account found for this email."
        : err.message;
    return { ok: false, error: msg };
  }
}

export async function logoutUser() {
  try { await signOut(auth); } catch { /* no-op */ }
}

export async function getSessionUser() {
  if (!auth.currentUser) return null;
  try {
    const profile = await apiFetch("/users/profile");
    return toSafeUser(profile);
  } catch {
    return null;
  }
}

export async function saveUserMetrics({ heightCm, weightKg, targetSteps, caloriesTarget }) {
  const parsedHeight = Number(heightCm);
  const parsedWeight = Number(weightKg);
  const parsedSteps = Number(targetSteps);
  const parsedCalories = Number(caloriesTarget);

  if (!Number.isFinite(parsedHeight) || parsedHeight < 80 || parsedHeight > 260)
    return { ok: false, error: "Enter a valid height in cm." };
  if (!Number.isFinite(parsedWeight) || parsedWeight < 20 || parsedWeight > 400)
    return { ok: false, error: "Enter a valid weight in kg." };
  if (!Number.isFinite(parsedSteps) || parsedSteps < 1000 || parsedSteps > 50000)
    return { ok: false, error: "Enter a valid target steps (1000-50000)." };
  if (!Number.isFinite(parsedCalories) || parsedCalories < 1200 || parsedCalories > 5000)
    return { ok: false, error: "Enter a valid daily calories target (1200-5000)." };

  try {
    const profile = await apiFetch("/users/metrics", {
      method: "POST",
      body: JSON.stringify({
        heightCm: Number(parsedHeight.toFixed(1)),
        weightKg: Number(parsedWeight.toFixed(1)),
        targetSteps: parsedSteps,
        caloriesTarget: parsedCalories,
      }),
    });
    return { ok: true, user: toSafeUser(profile) };
  } catch (err) {
    return { ok: false, error: err.message || "Could not save metrics." };
  }
}

export async function updateUserProfileField({ field, value }) {
  const validations = {
    name: (v) => String(v).trim() ? null : "Name is required.",
    age: (v) => (Number.isFinite(Number(v)) && Number(v) >= 1 && Number(v) <= 120) ? null : "Enter a valid age.",
    gender: (v) => ["Male", "Female", "Other", "Prefer not to say"].includes(v) ? null : "Select a valid gender.",
    heightCm: (v) => (Number.isFinite(Number(v)) && Number(v) >= 80 && Number(v) <= 260) ? null : "Enter a valid height in cm.",
    weightKg: (v) => (Number.isFinite(Number(v)) && Number(v) >= 20 && Number(v) <= 400) ? null : "Enter a valid weight in kg.",
    targetSteps: (v) => (Number.isFinite(Number(v)) && Number(v) >= 1000 && Number(v) <= 50000) ? null : "Enter valid target steps (1000-50000).",
    caloriesTarget: (v) => (Number.isFinite(Number(v)) && Number(v) >= 1200 && Number(v) <= 5000) ? null : "Enter valid daily calories target (1200-5000).",
  };

  const validate = validations[field];
  if (!validate) return { ok: false, error: "Unsupported profile field." };
  const error = validate(value);
  if (error) return { ok: false, error };

  try {
    const profile = await apiFetch("/users/profile", {
      method: "PUT",
      body: JSON.stringify({ field, value }),
    });
    return { ok: true, user: toSafeUser(profile) };
  } catch (err) {
    return { ok: false, error: err.message || "Could not save profile changes." };
  }
}

export function subscribeToAuthChanges(callback) {
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const profile = await apiFetch("/users/profile");
        callback(toSafeUser(profile));
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
  return unsubscribe;
}