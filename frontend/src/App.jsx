
import { useState } from "react";
import Startup from "./pages/Startup";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";

export default function App() {
  const [page, setPage] = useState("startup");

  if (page === "startup") return <Startup goLogin={() => setPage("login")} goSignup={() => setPage("signup")} />;
  if (page === "login") return <Login onContinue={() => setPage("home")} goSignup={() => setPage("signup")} />;
  if (page === "signup") return <Signup onContinue={() => setPage("home")} goLogin={() => setPage("login")} />;
  return <Home />;
}
