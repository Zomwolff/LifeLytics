import { useEffect, useState } from "react";
import Startup from "./pages/Startup";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import AiInsights from "./pages/AiInsights";
import Chatbot from "./pages/Chatbot";
import Metrics from "./pages/Metrics";
import Trends from "./pages/Trends";
import FoodLog from "./pages/FoodLog";
import SetupMetrics from "./pages/SetupMetrics";
import Profile from "./pages/Profile";
import { getSessionUser, loginUser, logoutUser, registerUser, saveUserMetrics, subscribeToAuthChanges, updateUserProfileField } from "./auth";

const PAGE_KEY = "lifelytics_page_v1";
const CHAT_RETURN_PAGE_KEY = "lifelytics_chat_return_page_v1";

function hasMetrics(user) {
  return Boolean(user && Number.isFinite(user.heightCm) && Number.isFinite(user.weightKg));
}

function getSavedPage() {
  try { return sessionStorage.getItem(PAGE_KEY); } catch { return null; }
}

function setSavedPage(page) {
  try { sessionStorage.setItem(PAGE_KEY, page); } catch { /* no-op */ }
}

function clearSavedPage() {
  try { sessionStorage.removeItem(PAGE_KEY); } catch { /* no-op */ }
}

function getSavedChatReturnPage() {
  try { return sessionStorage.getItem(CHAT_RETURN_PAGE_KEY) || "home"; } catch { return "home"; }
}

function setSavedChatReturnPage(page) {
  try { sessionStorage.setItem(CHAT_RETURN_PAGE_KEY, page); } catch { /* no-op */ }
}

function clearSavedChatReturnPage() {
  try { sessionStorage.removeItem(CHAT_RETURN_PAGE_KEY); } catch { /* no-op */ }
}

function isPublicPage(page) {
  return ["startup", "login", "signup"].includes(page);
}

function pageToPath(page) {
  return `/${page}`;
}

function pathToPage(path) {
  if (!path || path === "/") return null;
  return path.replace(/^\//, "");
}

export default function App() {
  const [page, setPageState] = useState(() => {
    const savedPage = getSavedPage();
    return savedPage && isPublicPage(savedPage) ? savedPage : "startup";
  });
  const [user, setUser] = useState(null);
  const [chatReturnPage, setChatReturnPage] = useState(() => getSavedChatReturnPage());

  // Wrapper around setPageState to also update browser history
  const setPage = (newPage) => {
    setPageState(newPage);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", pageToPath(newPage));
    }
  };

  useEffect(() => {
    setSavedPage(page);
  }, [page]);

  useEffect(() => {
    setSavedChatReturnPage(chatReturnPage);
  }, [chatReturnPage]);

  // Initialize history and handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const pathPage = pathToPage(path);
      if (pathPage) {
        setPageState(pathPage);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    // getSessionUser is now async — Firebase checks auth state
    getSessionUser().then((sessionUser) => {
      if (sessionUser) {
        setUser(sessionUser);
        const savedPage = getSavedPage();
        setPage(() => {
          if (savedPage && !isPublicPage(savedPage)) {
            if (hasMetrics(sessionUser) || savedPage === "setup-metrics") return savedPage;
            return "setup-metrics";
          }
          return hasMetrics(sessionUser) ? "home" : "setup-metrics";
        });
      }
    });

    const unsubscribe = subscribeToAuthChanges((nextUser) => {
      if (nextUser) {
        setUser(nextUser);
        setPage((currentPage) => {
          if (currentPage === "startup" || currentPage === "login" || currentPage === "signup") {
            return hasMetrics(nextUser) ? "home" : "setup-metrics";
          }
          if (currentPage === "setup-metrics" && hasMetrics(nextUser)) {
            return "home";
          }
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

  async function handleSaveMetrics(payload) {
    const result = await saveUserMetrics(payload);
    if (result.ok) {
      setUser(result.user);
      setPage("home");
    }
    return result;
  }

  async function handleSaveProfileField({ field, value }) {
    const result = await updateUserProfileField({ field, value });
    if (result.ok) {
      setUser(result.user);
    }
    return result;
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null);
    clearSavedPage();
    clearSavedChatReturnPage();
    setPage("startup");
  }

  if (page === "startup") return <Startup goLogin={() => setPage("login")} goSignup={() => setPage("signup")} />;
  if (page === "login") return <Login onContinue={handleLogin} goSignup={() => setPage("signup")} />;
  if (page === "signup") return <Signup onContinue={handleSignup} goLogin={() => setPage("login")} />;
  if (page === "setup-metrics") return <SetupMetrics user={user} onContinue={handleSaveMetrics} />;
  if (page === "profile") return <Profile user={user} onSaveField={handleSaveProfileField} goBack={() => setPage("home")} />;
  if (page === "ai-insights") return <AiInsights user={user} goBack={() => setPage("home")} />;
  if (page === "chat") return <Chatbot user={user} goBack={() => setPage(chatReturnPage)} />;
  if (page === "metrics") return <Metrics user={user} onLogout={handleLogout} goBack={() => setPage("home")} goHome={() => setPage("home")} goProfile={() => setPage("profile")} goMetrics={() => setPage("metrics")} goChat={() => { setChatReturnPage("metrics"); setPage("chat"); }} />;
  if (page === "trends") return <Trends user={user} goBack={() => setPage("home")} />;
  if (page === "food-log") return <FoodLog user={user} goBack={() => setPage("home")} />;
  return <Home user={user} onLogout={handleLogout} goHome={() => setPage("home")} goProfile={() => setPage("profile")} goMetrics={() => setPage("metrics")} goTrends={() => setPage("trends")} goAi={() => setPage("ai-insights")} goFoodLog={() => setPage("food-log")} goChat={() => { setChatReturnPage("home"); setPage("chat"); }} />;
}