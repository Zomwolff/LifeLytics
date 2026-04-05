const USERS_KEY = "lifelytics_users_v1";
const SESSION_COOKIE = "lifelytics_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

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

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export async function registerUser({ name, email, password, confirmPassword }) {
  const cleanName = name.trim();
  const cleanEmail = normalizeEmail(email);

  if (!cleanName) {
    return { ok: false, error: "Name is required." };
  }

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { ok: false, error: "Enter a valid email." };
  }

  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  if (password !== confirmPassword) {
    return { ok: false, error: "Passwords do not match." };
  }

  const users = loadUsers();
  const exists = users.some((u) => u.email === cleanEmail);
  if (exists) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = {
    id: crypto.randomUUID(),
    name: cleanName,
    email: cleanEmail,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);
  setSessionCookie(user.id);
  return { ok: true, user: toSafeUser(user) };
}

export async function loginUser({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  const users = loadUsers();
  const user = users.find((u) => u.email === cleanEmail);

  if (!user) {
    return { ok: false, error: "No account found for this email." };
  }

  const passwordHash = await hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) {
    return { ok: false, error: "Incorrect password." };
  }

  setSessionCookie(user.id);
  return { ok: true, user: toSafeUser(user) };
}

export function getSessionUser() {
  const sessionId = getCookie(SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }

  const userId = decodeURIComponent(sessionId);
  const users = loadUsers();
  const user = users.find((u) => u.id === userId);
  return user ? toSafeUser(user) : null;
}

export function logoutUser() {
  clearSessionCookie();
}