import React, { useState, useRef, useEffect } from "react";
import { sendMessage, endSession } from "../api/client";
import LiveScorePanel from "./LiveScorePanel";
import { Send, Square, UserRound, Stethoscope } from "lucide-react";

function formatPatientText(text) {
  return text.split(/(\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className="action-text">
          {part}
        </em>
      );
    }
    return part;
  });
}

export default function ConversationView({ session, onEndSession }) {
  const [messages, setMessages] = useState([
    { role: "patient", content: session.opening_line },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [scores, setScores] = useState([]);
  const [emotionalState, setEmotionalState] = useState("calm");
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "clinician", content: text }]);
    setIsLoading(true);

    try {
      const result = await sendMessage(session.session_id, text);
      setMessages((prev) => [
        ...prev,
        { role: "patient", content: result.patient_response },
      ]);
      setScores((prev) => [
        ...prev,
        {
          empathy_score: result.empathy_score,
          spikes_score: result.spikes_score,
          spikes_step: result.spikes_step,
          tone: result.tone,
        },
      ]);
      setEmotionalState(result.emotional_state || "engaged");
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "patient", content: "*pauses, seeming to need a moment*" },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEnd = async () => {
    setIsEnding(true);
    try {
      const debrief = await endSession(session.session_id);
      onEndSession(debrief);
    } catch {
      alert("Failed to generate debrief. Please try again.");
      setIsEnding(false);
    }
  };

  return (
    <div className="conv-layout">
      {/* Main chat panel */}
      <div className="conv-panel">
        <div className="conv-topbar">
          <div className="conv-topbar-left">
            <div className="conv-avatar patient-avatar">
              <UserRound size={18} />
            </div>
            <div>
              <h3 className="conv-patient-name">{session.patient_name}</h3>
              <p className="conv-scenario-label">{session.scenario_title}</p>
            </div>
          </div>
          <button
            className="btn btn-end"
            onClick={handleEnd}
            disabled={isEnding || messages.length < 3}
            aria-label="End session and view debrief"
          >
            <Square size={14} />
            {isEnding ? "Generating Debrief..." : "End Session"}
          </button>
        </div>

        <div className="conv-role-banner">
          <Stethoscope size={14} />
          <span>{session.clinician_role}</span>
        </div>

        <div className="conv-messages" role="log" aria-live="polite">
          {messages.map((msg, i) => (
            <div key={i} className={`msg msg-${msg.role}`}>
              <div className={`msg-avatar ${msg.role === "patient" ? "patient-avatar" : "clinician-avatar"}`}>
                {msg.role === "patient" ? (
                  <UserRound size={16} />
                ) : (
                  <Stethoscope size={16} />
                )}
              </div>
              <div className="msg-body">
                <span className="msg-sender">
                  {msg.role === "patient" ? session.patient_name : "You"}
                </span>
                <div className="msg-content">
                  {msg.role === "patient"
                    ? formatPatientText(msg.content)
                    : msg.content}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="msg msg-patient">
              <div className="msg-avatar patient-avatar">
                <UserRound size={16} />
              </div>
              <div className="msg-body">
                <span className="msg-sender">{session.patient_name}</span>
                <div className="msg-content">
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="conv-input-area">
          <div className="conv-input-wrapper">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isLoading
                  ? "Patient is responding..."
                  : "Respond as the clinician... (Enter to send)"
              }
              disabled={isLoading || isEnding}
              rows={1}
              aria-label="Your response as the clinician"
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isEnding}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar scores */}
      <LiveScorePanel scores={scores} emotionalState={emotionalState} />
    </div>
  );
}
