import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "../api/client";

function normalizeAssistantText(payload) {
  const asObject = typeof payload === "object" && payload !== null ? payload : null;
  if (asObject) {
    const nested = asObject.response ?? asObject.message ?? asObject.content;
    if (typeof nested === "string") return normalizeAssistantText(nested);
    if (nested && typeof nested === "object") return normalizeAssistantText(nested);
  }

  const asText = typeof payload === "string"
    ? payload
    : typeof payload === "number" || typeof payload === "boolean"
      ? String(payload)
      : "";

  if (!asText.trim()) {
    return "I could not generate a clear response right now. If this is about pain, posture, fever, weakness, numbness, or an injury, please share those details and I can suggest safe next steps.";
  }

  const trimmed = asText.trim();

  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeAssistantText(parsed);
    } catch {
      // Keep original text when it is not valid JSON.
    }
  }

  return trimmed.replace(/^"|"$/g, "").replace(/\\n/g, "\n").trim();
}

export default function Chatbot({ user, goBack }) {
  const [chatInput, setChatInput] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [messages, setMessages] = useState([]);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  // Load persistent chat history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await apiFetch("/chatbot/history");
        if (data.history && data.history.length > 0) {
          setMessages(data.history.map((m) => ({
            id: m.id || crypto.randomUUID(),
            role: m.role,
            text: m.text,
          })));
        } else {
          setMessages([{
            id: crypto.randomUUID(),
            role: "assistant",
            text: `Hi ${user?.name || "there"}, how can I help you today?`,
          }]);
        }
      } catch {
        setMessages([{
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Hi ${user?.name || "there"}, how can I help you today?`,
        }]);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadHistory();
  }, [user?.name]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isReplying]);

  async function handleClearHistory() {
    try {
      await apiFetch("/chatbot/history", { method: "DELETE" });
      setMessages([{
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Hi ${user?.name || "there"}, how can I help you today?`,
      }]);
    } catch {
      // no-op
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isReplying) return;

    const text = chatInput.trim();
    if (!text) return;

    const userMessage = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    setIsReplying(true);
    try {
      const data = await apiFetch("/chatbot/", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      const assistantText = normalizeAssistantText(data);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: assistantText,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Unable to reach backend right now.",
      }]);
    } finally {
      setIsReplying(false);
    }
  }

  function handleInputChange(event) {
    setChatInput(event.target.value);
    event.target.style.height = "auto";
    const nextHeight = Math.min(event.target.scrollHeight, 140);
    event.target.style.height = `${nextHeight}px`;
  }

  function handleInputKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(140deg,#eef3ff_0%,#d6e2f5_42%,#c4d2e5_100%)] px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-6 md:px-8 lg:px-10"
      style={{ fontFamily: "'Sora', sans-serif" }}
    >
      <div className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#71bcff_0%,rgba(113,188,255,0.32)_56%,transparent_100%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#69dcb0_0%,rgba(105,220,176,0.28)_56%,transparent_100%)] blur-2xl" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[980px] flex-col sm:min-h-[calc(100vh-3rem)]"
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

          <button
            type="button"
            onClick={handleClearHistory}
            className="rounded-full border border-[#8ea2bf] bg-[rgba(255,255,255,0.68)] px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-[#29405e] shadow-[0_8px_18px_rgba(31,43,64,0.15)]"
          >
            Clear
          </button>
        </header>

        <div className="flex-1 overflow-y-auto rounded-[1rem] border border-[#a3b3cb] bg-[rgba(255,255,255,0.46)] px-3 py-3 shadow-[0_8px_20px_rgba(31,43,64,0.12)] backdrop-blur-[2px] md:px-4 md:py-4">
          {isLoadingHistory ? (
            <p className="pt-4 text-center text-xs font-semibold text-[#4e6486]">Loading history...</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={`w-fit max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-[0_4px_10px_rgba(20,34,52,0.08)] md:max-w-[78%] ${
                    message.role === "user"
                      ? "self-end bg-[linear-gradient(160deg,#1f2c40,#131a26)] text-white"
                      : "self-start bg-[rgba(31,44,64,0.08)] text-[#1a2b43]"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                </li>
              ))}
              {isReplying ? (
                <li className="self-start w-fit max-w-[92%] rounded-2xl bg-[rgba(31,44,64,0.08)] px-3 py-2 text-[#1a2b43] shadow-[0_4px_10px_rgba(20,34,52,0.08)] md:max-w-[78%]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">LifeLytics is thinking</span>
                    <div className="flex items-end gap-1" aria-label="Assistant is typing" role="status" aria-live="polite">
                      <span className="h-2 w-1 rounded bg-[#2c4567] animate-pulse" style={{ animationDelay: "0ms" }} />
                      <span className="h-3 w-1 rounded bg-[#2c4567] animate-pulse" style={{ animationDelay: "120ms" }} />
                      <span className="h-2 w-1 rounded bg-[#2c4567] animate-pulse" style={{ animationDelay: "240ms" }} />
                      <span className="h-3 w-1 rounded bg-[#2c4567] animate-pulse" style={{ animationDelay: "360ms" }} />
                    </div>
                  </div>
                </li>
              ) : null}
              <div ref={bottomRef} />
            </ul>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-3 rounded-[1rem] border border-[#a3b3cb] bg-[rgba(255,255,255,0.56)] px-3 py-2 shadow-[0_8px_20px_rgba(31,43,64,0.14)] backdrop-blur-[2px]"
        >
          <div className="flex items-end gap-2 text-[#3a4c68]">
            <button type="button" aria-label="Attach file" className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.6rem] border border-[#6a7f9f] text-3xl leading-none text-[#21314a]">
              +
            </button>
            <textarea
              ref={inputRef}
              value={chatInput}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder="Type your message..."
              disabled={isReplying}
              rows={1}
              className="max-h-[140px] min-h-[2.25rem] w-full resize-none overflow-y-auto rounded-[0.7rem] border border-[#b7c5d9] bg-[rgba(255,255,255,0.65)] px-3 py-2 text-sm font-medium text-[#1a2b43] outline-none placeholder:text-[#667a98]"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={isReplying}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[0.6rem] border border-[#6a7f9f] text-[#21314a]"
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