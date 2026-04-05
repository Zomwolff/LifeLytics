
import { useEffect, useState } from "react";
import Startup from "./pages/Startup";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import { getSessionUser, loginUser, logoutUser, registerUser } from "./auth";

export default function App() {
  const [page, setPage] = useState("startup");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const sessionUser = getSessionUser();
    if (sessionUser) {
      setUser(sessionUser);
      setPage("home");
    }
  }, []);

  async function handleLogin(payload) {
    const result = await loginUser(payload);
    if (result.ok) {
      setUser(result.user);
      setPage("home");
    }
    return result;
  }

  async function handleSignup(payload) {
    const result = await registerUser(payload);
    if (result.ok) {
      setUser(result.user);
      setPage("home");
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
  return <Home user={user} onLogout={handleLogout} />;
}
