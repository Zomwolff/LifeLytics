import { useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../api/client";

export default function Chatbot({ user, goBack }) {
  // TODO: Flip this to true (or derive from env/config) once chatbot backend is connected.
  const isBackendConnected = true;

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      text: isBackendConnected
        ? `Hi ${user?.name || "there"}, how can I help you today?`
        : "Backend not connected yet.",
    },
  ]);

  async function handleSubmit(event) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) {
      return;
    }

    const userMessage = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    if (!isBackendConnected) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Backend not connected yet.",
        },
      ]);
      return;
    }

    try {
      const data = await apiFetch("/chatbot/", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.response,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Unable to reach backend right now.",
      }]);
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-4 py-6 md:px-8 lg:px-10"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#71bcff_0%,rgba(113,188,255,0.32)_56%,transparent_100%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#69dcb0_0%,rgba(105,220,176,0.28)_56%,transparent_100%)] blur-2xl" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[980px] flex-col"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            className="grid h-10 min-w-10 place-items-center rounded-full border border-[#8ea2bf] bg-[rgba(255,255,255,0.68)] px-3 text-[#23334d] shadow-[0_8px_18px_rgba(31,43,64,0.15)]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="text-right">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#3b4f6d]">Assistant</p>
            <p className="text-sm font-semibold text-[#13223a]">LifeLytics Chatbot</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto rounded-[1rem] border border-[#a3b3cb] bg-[rgba(255,255,255,0.46)] px-3 py-3 shadow-[0_8px_20px_rgba(31,43,64,0.12)] backdrop-blur-[2px] md:px-4 md:py-4">
          <ul className="space-y-2">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto bg-[linear-gradient(160deg,#1f2c40,#131a26)] text-white"
                    : "mr-auto bg-[rgba(31,44,64,0.08)] text-[#1a2b43]"
                }`}
              >
                {message.text}
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-3 rounded-[1rem] border border-[#a3b3cb] bg-[rgba(255,255,255,0.56)] px-3 py-2 shadow-[0_8px_20px_rgba(31,43,64,0.14)] backdrop-blur-[2px]"
        >
          <div className="flex items-center gap-2 text-[#3a4c68]">
            <button type="button" aria-label="Attach file" className="grid h-9 w-9 place-items-center rounded-[0.6rem] border border-[#6a7f9f] text-3xl leading-none text-[#21314a]">
              +
            </button>
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Type your message..."
              className="h-9 w-full rounded-[0.7rem] border border-[#b7c5d9] bg-[rgba(255,255,255,0.65)] px-3 text-sm font-medium text-[#1a2b43] outline-none placeholder:text-[#667a98]"
            />
            <button
              type="submit"
              aria-label="Send message"
              className="grid h-9 w-9 place-items-center rounded-[0.6rem] border border-[#6a7f9f] text-[#21314a]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
