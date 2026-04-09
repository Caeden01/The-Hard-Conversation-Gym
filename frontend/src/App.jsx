import React, { useState } from "react";
import ScenarioSelector from "./components/ScenarioSelector";
import ConversationView from "./components/ConversationView";
import VoiceConversation from "./components/VoiceConversation";
import DebriefReport from "./components/DebriefReport";
import { Stethoscope, Mic, MessageSquare } from "lucide-react";
import "./App.css";

export default function App() {
  const [screen, setScreen] = useState("scenarios");
  const [session, setSession] = useState(null);
  const [debriefData, setDebriefData] = useState(null);
  const [mode, setMode] = useState("voice"); // "text" | "voice"

  const handleStartSession = (sessionData) => {
    setSession(sessionData);
    setScreen("conversation");
  };

  const handleEndSession = (debrief) => {
    setDebriefData(debrief);
    setScreen("debrief");
  };

  const handleBackToScenarios = () => {
    setScreen("scenarios");
    setSession(null);
    setDebriefData(null);
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="app-header" role="banner">
        <div className="header-inner">
          <div
            className="header-brand"
            onClick={handleBackToScenarios}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleBackToScenarios()}
            aria-label="Return to scenario selection"
          >
            <div className="brand-icon">
              <Stethoscope size={22} strokeWidth={2} />
            </div>
            <div>
              <h1>The Hard Conversation Gym</h1>
              <p className="subtitle">Clinical Communication Trainer</p>
            </div>
          </div>
          <div className="header-right">
            {screen === "conversation" && session && (
              <span className="session-badge">
                {mode === "voice" ? (
                  <><Mic size={12} /> Voice Session</>
                ) : (
                  <><MessageSquare size={12} /> Text Session</>
                )}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="app-main" id="main-content">
        {screen === "scenarios" && (
          <ScenarioSelector
            onStartSession={handleStartSession}
            mode={mode}
            onModeChange={setMode}
          />
        )}
        {screen === "conversation" && session && mode === "text" && (
          <ConversationView
            session={session}
            onEndSession={handleEndSession}
          />
        )}
        {screen === "conversation" && session && mode === "voice" && (
          <VoiceConversation
            session={session}
            onEndSession={handleEndSession}
          />
        )}
        {screen === "debrief" && debriefData && (
          <DebriefReport
            debrief={debriefData}
            session={session}
            onBack={handleBackToScenarios}
          />
        )}
      </main>
    </div>
  );
}
