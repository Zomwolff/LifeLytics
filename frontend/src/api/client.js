import { auth } from "../firebase";

const BASE = import.meta.env.VITE_API_URL || "";

export async function apiFetch(path, options = {}) {
  let token = null;
  try {
    const user = auth.currentUser;
    if (user) token = await user.getIdToken();
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