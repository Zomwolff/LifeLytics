import { auth } from "./firebase";
import { apiFetch } from "./api/client";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const USERS_KEY = "lifelytics_users_v1";
const SESSION_KEY = "lifelytics_session_v1";
const SESSION_COOKIE = "lifelytics_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const AUTH_CHANGED_EVENT = "lifelytics-auth-changed";

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function randomSalt(length = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function setSessionCookie(userId) {
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(userId)}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

function setSessionStorage(userId) {
  localStorage.setItem(SESSION_KEY, userId);
}

function clearSessionStorage() {
  localStorage.removeItem(SESSION_KEY);
}

function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function getCookie(name) {
  const needle = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(needle))
    ?.slice(needle.length);
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function getStoredSessionId() {
  const localSessionId = localStorage.getItem(SESSION_KEY);
  if (localSessionId) {
    return localSessionId;
  }

  const cookieSessionId = getCookie(SESSION_COOKIE);
  if (!cookieSessionId) {
    return null;
  }

  const decoded = decodeURIComponent(cookieSessionId);
  // Migrate cookie-only sessions into localStorage for cross-tab consistency.
  setSessionStorage(decoded);
  return decoded;
}

function setSession(userId) {
  setSessionStorage(userId);
  setSessionCookie(userId);
  notifyAuthChanged();
}

function clearSession() {
  clearSessionStorage();
  clearSessionCookie();
  notifyAuthChanged();
}

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    age: user.age ?? null,
    gender: user.gender ?? null,
    heightCm: user.heightCm ?? null,
    weightKg: user.weightKg ?? null,
    targetSteps: user.targetSteps ?? null,
    caloriesTarget: user.caloriesTarget ?? null,
  };
}

export async function registerUser({ name, email, password, confirmPassword }) {
  const cleanName = name.trim();
  const cleanEmail = normalizeEmail(email);

  if (!cleanName) return { ok: false, error: "Name is required." };
  if (!cleanEmail || !cleanEmail.includes("@")) return { ok: false, error: "Enter a valid email." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { ok: false, error: "Passwords do not match." };

  const users = loadUsers();
  const exists = users.some((u) => u.email === cleanEmail);
  if (exists) return { ok: false, error: "An account with this email already exists." };

  try {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const firebaseUid = credential.user.uid;

    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);
    const user = {
      id: firebaseUid,          // use Firebase UID as local ID
      name: cleanName,
      email: cleanEmail,
      age: null,
      gender: null,
      heightCm: null,
      weightKg: null,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    saveUsers(users);
    setSession(firebaseUid);

    try {
      await apiFetch("/health/profile", {
        method: "POST",
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
        }),
      });
    } catch {
      saveUsers(users.filter((u) => u.id !== firebaseUid));
      await signOut(auth).catch(() => {});
      clearSession();
      return { ok: false, error: "Could not create the Firestore profile." };
    }

    return { ok: true, user: toSafeUser(user) };
  } catch (err) {
    const msg = err.code === "auth/email-already-in-use"
      ? "An account with this email already exists."
      : err.message;
    return { ok: false, error: msg };
  }
}

export async function loginUser({ email, password }) {
  const cleanEmail = normalizeEmail(email);

  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const firebaseUid = credential.user.uid;

    const users = loadUsers();
    let user = users.find((u) => u.id === firebaseUid);

    // Fallback: match by email for accounts created before Firebase sync
    if (!user) user = users.find((u) => u.email === cleanEmail);
    if (!user) return { ok: false, error: "No local profile found. Please sign up again." };

    // Ensure local ID matches Firebase UID
    if (user.id !== firebaseUid) {
      const index = users.findIndex((u) => u.email === cleanEmail);
      users[index] = { ...users[index], id: firebaseUid };
      saveUsers(users);
      user = users[index];
    }

    setSession(firebaseUid);
    return { ok: true, user: toSafeUser(user) };
  } catch (err) {
    const msg =
      err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
        ? "Incorrect email or password."
        : err.code === "auth/user-not-found"
        ? "No account found for this email."
        : err.message;
    return { ok: false, error: msg };
  }
}

export function getSessionUser() {
  const sessionId = getStoredSessionId();
  if (!sessionId) {
    return null;
  }

  const users = loadUsers();
  const user = users.find((u) => u.id === sessionId);
  return user ? toSafeUser(user) : null;
}

export async function logoutUser() {
  try { await signOut(auth); } catch { /* no-op */ }
  clearSession();
}

export async function saveUserMetrics({ userId, heightCm, weightKg, targetSteps, caloriesTarget }) {
  const parsedHeight = Number(heightCm);
  const parsedWeight = Number(weightKg);
  const parsedSteps = Number(targetSteps);
  const parsedCalories = Number(caloriesTarget);

  if (!Number.isFinite(parsedHeight) || parsedHeight < 80 || parsedHeight > 260) {
    return { ok: false, error: "Enter a valid height in cm." };
  }

  if (!Number.isFinite(parsedWeight) || parsedWeight < 20 || parsedWeight > 400) {
    return { ok: false, error: "Enter a valid weight in kg." };
  }

  if (!Number.isFinite(parsedSteps) || parsedSteps < 1000 || parsedSteps > 50000) {
    return { ok: false, error: "Enter a valid target steps (1000-50000)." };
  }

  if (!Number.isFinite(parsedCalories) || parsedCalories < 1200 || parsedCalories > 5000) {
    return { ok: false, error: "Enter a valid daily calories target (1200-5000)." };
  }

  const users = loadUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index < 0) {
    return { ok: false, error: "User session not found. Please login again." };
  }

  users[index] = {
    ...users[index],
    heightCm: Number(parsedHeight.toFixed(1)),
    weightKg: Number(parsedWeight.toFixed(1)),
    targetSteps: parsedSteps,
    caloriesTarget: parsedCalories,
    updatedAt: new Date().toISOString(),
  };

  try {
    await apiFetch("/health/profile", {
      method: "POST",
      body: JSON.stringify({
        heightCm: Number(parsedHeight.toFixed(1)),
        weightKg: Number(parsedWeight.toFixed(1)),
        targetSteps: parsedSteps,
        caloriesTarget: parsedCalories,
      }),
    });
  } catch (err) {
    return { ok: false, error: "Could not save metrics to Firestore." };
  }

  saveUsers(users);
  notifyAuthChanged();
  return { ok: true, user: toSafeUser(users[index]) };
}

export async function updateUserProfileField({ userId, field, value }) {
  const users = loadUsers();
  const index = users.findIndex((u) => u.id === userId);
  if (index < 0) {
    return { ok: false, error: "User session not found. Please login again." };
  }

  const current = users[index];

  if (field === "name") {
    const nextName = String(value ?? "").trim();
    if (!nextName) {
      return { ok: false, error: "Name is required." };
    }
    users[index] = { ...current, name: nextName, updatedAt: new Date().toISOString() };
  } else if (field === "age") {
    const parsedAge = Number(value);
    if (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      return { ok: false, error: "Enter a valid age." };
    }
    users[index] = { ...current, age: Math.round(parsedAge), updatedAt: new Date().toISOString() };
  } else if (field === "gender") {
    const allowed = ["Male", "Female", "Other", "Prefer not to say"];
    const nextGender = String(value ?? "").trim();
    if (!allowed.includes(nextGender)) {
      return { ok: false, error: "Select a valid gender." };
    }
    users[index] = { ...current, gender: nextGender, updatedAt: new Date().toISOString() };
  } else if (field === "heightCm") {
    const parsedHeight = Number(value);
    if (!Number.isFinite(parsedHeight) || parsedHeight < 80 || parsedHeight > 260) {
      return { ok: false, error: "Enter a valid height in cm." };
    }
    users[index] = { ...current, heightCm: Number(parsedHeight.toFixed(1)), updatedAt: new Date().toISOString() };
  } else if (field === "weightKg") {
    const parsedWeight = Number(value);
    if (!Number.isFinite(parsedWeight) || parsedWeight < 20 || parsedWeight > 400) {
      return { ok: false, error: "Enter a valid weight in kg." };
    }
    users[index] = { ...current, weightKg: Number(parsedWeight.toFixed(1)), updatedAt: new Date().toISOString() };
  } else if (field === "targetSteps") {
    const parsedSteps = Number(value);
    if (!Number.isFinite(parsedSteps) || parsedSteps < 1000 || parsedSteps > 50000) {
      return { ok: false, error: "Enter valid target steps (1000-50000)." };
    }
    users[index] = { ...current, targetSteps: parsedSteps, updatedAt: new Date().toISOString() };
  } else if (field === "caloriesTarget") {
    const parsedCalories = Number(value);
    if (!Number.isFinite(parsedCalories) || parsedCalories < 1200 || parsedCalories > 5000) {
      return { ok: false, error: "Enter valid daily calories target (1200-5000)." };
    }
    users[index] = { ...current, caloriesTarget: parsedCalories, updatedAt: new Date().toISOString() };
  } else {
    return { ok: false, error: "Unsupported profile field." };
  }

  try {
    await apiFetch("/health/profile", {
      method: "POST",
      body: JSON.stringify({ [field]: users[index][field] ?? value }),
    });
  } catch {
    return { ok: false, error: "Could not save profile changes to Firestore." };
  }

  saveUsers(users);
  notifyAuthChanged();
  return { ok: true, user: toSafeUser(users[index]) };
}

export function subscribeToAuthChanges(callback) {
  function handleStorage(event) {
    if (event.key === SESSION_KEY || event.key === USERS_KEY || event.key === null) {
      callback(getSessionUser());
    }
  }

  function handleAuthChanged() {
    callback(getSessionUser());
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
  };
}