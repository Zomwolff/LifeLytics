
import { useEffect, useState } from "react";
import Startup from "./pages/Startup";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Chatbot from "./pages/Chatbot";
import Metrics from "./pages/Metrics";
import SetupMetrics from "./pages/SetupMetrics";
import Profile from "./pages/Profile";
import { getSessionUser, loginUser, logoutUser, registerUser, saveUserMetrics, subscribeToAuthChanges, updateUserProfileField } from "./auth";

function hasMetrics(user) {
  return Boolean(user && Number.isFinite(user.heightCm) && Number.isFinite(user.weightKg));
}

export default function App() {
  const [page, setPage] = useState("startup");
  const [user, setUser] = useState(null);
  const [chatReturnPage, setChatReturnPage] = useState("home");

  useEffect(() => {
    const sessionUser = getSessionUser();
    if (sessionUser) {
      setUser(sessionUser);
      setPage(hasMetrics(sessionUser) ? "home" : "setup-metrics");
    }

    const unsubscribe = subscribeToAuthChanges((nextUser) => {
      if (nextUser) {
        setUser(nextUser);
        setPage((currentPage) => {
          // Only auto-route on auth boundaries or required onboarding transitions.
          if (currentPage === "startup" || currentPage === "login" || currentPage === "signup") {
            return hasMetrics(nextUser) ? "home" : "setup-metrics";
          }

          if (currentPage === "setup-metrics" && hasMetrics(nextUser)) {
            return "home";
          }

          // Keep user on current page (e.g. profile) after saving edits.
          return currentPage;
        });
      } else {
        setUser(null);
        setPage("startup");
      }
    });

    return unsubscribe;
  }, []);

  async function handleLogin(payload) {
    const result = await loginUser(payload);
    if (result.ok) {
      setUser(result.user);
      setPage(hasMetrics(result.user) ? "home" : "setup-metrics");
    }
    return result;
  }

  async function handleSignup(payload) {
    const result = await registerUser(payload);
    if (result.ok) {
      setUser(result.user);
      setPage("setup-metrics");
    }
    return result;
  }

  function handleSaveMetrics(payload) {
    if (!user?.id) {
      return { ok: false, error: "Session not found. Please login again." };
    }

    const result = saveUserMetrics({ userId: user.id, ...payload });
    if (result.ok) {
      setUser(result.user);
      setPage("home");
    }
    return result;
  }

  function handleSaveProfileField({ field, value }) {
    if (!user?.id) {
      return { ok: false, error: "Session not found. Please login again." };
    }

    const result = updateUserProfileField({ userId: user.id, field, value });
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  }

  function handleLogout() {
    logoutUser();
    setUser(null);
    setPage("startup");
  }

  if (page === "startup") return <Startup goLogin={() => setPage("login")} goSignup={() => setPage("signup")} />;
  if (page === "login") return <Login onContinue={handleLogin} goSignup={() => setPage("signup")} />;
  if (page === "signup") return <Signup onContinue={handleSignup} goLogin={() => setPage("login")} />;
  if (page === "setup-metrics") return <SetupMetrics user={user} onContinue={handleSaveMetrics} />;
  if (page === "profile") return <Profile user={user} onSaveField={handleSaveProfileField} goBack={() => setPage("home")} />;
  if (page === "chat") return <Chatbot user={user} goBack={() => setPage(chatReturnPage)} />;
  if (page === "metrics") return <Metrics user={user} onLogout={handleLogout} goHome={() => setPage("home")} goProfile={() => setPage("profile")} goMetrics={() => setPage("metrics")} goChat={() => { setChatReturnPage("metrics"); setPage("chat"); }} />;
  return <Home user={user} onLogout={handleLogout} goHome={() => setPage("home")} goProfile={() => setPage("profile")} goMetrics={() => setPage("metrics")} goChat={() => { setChatReturnPage("home"); setPage("chat"); }} />;
}
