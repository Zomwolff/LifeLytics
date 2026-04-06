import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

const BASE = import.meta.env.VITE_API_URL || "";

async function getTokenWhenReady(timeoutMs = 2500) {
  const existingUser = auth.currentUser;
  if (existingUser) {
    return existingUser.getIdToken();
  }

  // On first load, auth.currentUser can be null until Firebase restores session.
  const user = await new Promise((resolve) => {
    let settled = false;
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(nextUser || null);
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(null);
    }, timeoutMs);
  });

  if (!user) return null;
  return user.getIdToken();
}

export async function apiFetch(path, options = {}) {
  let token = null;
  try {
    token = await getTokenWhenReady();
  } catch {
    // no-op — DEV_MODE backend will still work without token
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}