import React from "react";
import {
  Heart,
  Shield,
  Gauge,
  Timer,
  AlertTriangle,
  Mic,
  Volume2,
} from "lucide-react";

function getScoreColor(score) {
  if (score >= 0.7) return "green";
  if (score >= 0.4) return "yellow";
  return "red";
}

const EMOTIONAL_CONFIG = {
  calm: { color: "#22C55E", bg: "#DCFCE7" },
  engaged: { color: "#0891B2", bg: "#E0F7FA" },
  distressed: { color: "#EAB308", bg: "#FEF9C3" },
  withdrawn: { color: "#94A3B8", bg: "#F1F5F9" },
  angry: { color: "#EF4444", bg: "#FEE2E2" },
  shocked: { color: "#F97316", bg: "#FFF7ED" },
  numb: { color: "#64748B", bg: "#F1F5F9" },
};

export default function VoiceScorePanel({
  scores,
  voiceAnalyses,
  emotionalState,
  isListening,
  isSpeaking,
}) {
  const emoConfig = EMOTIONAL_CONFIG[emotionalState] || EMOTIONAL_CONFIG.calm;

  const latestVoice = voiceAnalyses.length > 0 ? voiceAnalyses[voiceAnalyses.length - 1] : null;

  const avgEmpathy =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + s.empathy_score, 0) / scores.length
      : 0;

  const avgSpikes =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + s.spikes_score, 0) / scores.length
      : 0;

  const avgDelivery =
    voiceAnalyses.length > 0
      ? voiceAnalyses.reduce((sum, v) => sum + v.delivery_score, 0) / voiceAnalyses.length
      : 0;

  const avgWpm =
    voiceAnalyses.length > 0
      ? voiceAnalyses.reduce((sum, v) => sum + v.wpm, 0) / voiceAnalyses.length
      : 0;

  const totalFillers = voiceAnalyses.reduce((sum, v) => sum + v.filler_count, 0);
  const totalJargon = voiceAnalyses.reduce((sum, v) => sum + v.jargon_count, 0);

  return (
    <aside className="score-sidebar voice-sidebar" aria-label="Voice scoring panel">
      {/* Mic status */}
      <div className="sidebar-card">
        <div className="sidebar-card-label">
          <Mic size={13} />
          Voice Status
        </div>
        <div className="voice-status-row">
          <div className={`voice-status-indicator ${isListening ? "active" : ""}`}>
            <div className="vs-dot" />
            <span>{isListening ? "Listening" : "Mic Off"}</span>
          </div>
          {isSpeaking && (
            <div className="voice-status-indicator speaking">
              <Volume2 size={12} />
              <span>Patient</span>
            </div>
          )}
        </div>
      </div>

      {/* Patient Emotional State */}
      <div className="sidebar-card">
        <div className="sidebar-card-label">Patient State</div>
        <div className="emotional-badge" style={{ background: emoConfig.bg, color: emoConfig.color }}>
          <div className="emo-pulse" style={{ background: emoConfig.color }} />
          <span>{emotionalState}</span>
        </div>
      </div>

      {/* Communication Scores */}
      <div className="sidebar-card">
        <div className="sidebar-card-label">
          <Heart size={13} />
          Communication
        </div>
        <div className="voice-score-grid">
          <div className="voice-score-item">
            <div className="vs-value" style={{ color: avgEmpathy >= 0.7 ? "var(--green)" : avgEmpathy >= 0.4 ? "var(--yellow)" : "var(--red)" }}>
              {(avgEmpathy * 100).toFixed(0)}%
            </div>
            <div className="vs-label">Empathy</div>
          </div>
          <div className="voice-score-item">
            <div className="vs-value" style={{ color: avgSpikes >= 0.7 ? "var(--green)" : avgSpikes >= 0.4 ? "var(--yellow)" : "var(--red)" }}>
              {(avgSpikes * 100).toFixed(0)}%
            </div>
            <div className="vs-label">SPIKES</div>
          </div>
          <div className="voice-score-item">
            <div className="vs-value" style={{ color: avgDelivery >= 0.7 ? "var(--green)" : avgDelivery >= 0.4 ? "var(--yellow)" : "var(--red)" }}>
              {(avgDelivery * 100).toFixed(0)}%
            </div>
            <div className="vs-label">Delivery</div>
          </div>
        </div>
      </div>

      {/* Voice Delivery Metrics */}
      <div className="sidebar-card">
        <div className="sidebar-card-label">
          <Gauge size={13} />
          Delivery Metrics
        </div>
        <div className="voice-metric-list">
          {/* Speaking pace */}
          <div className="voice-metric">
            <div className="vm-top">
              <Timer size={12} />
              <span className="vm-name">Pace</span>
              <span className={`vm-value ${avgWpm >= 120 && avgWpm <= 150 ? "green" : avgWpm > 170 ? "red" : "yellow"}`}>
                {avgWpm > 0 ? `${avgWpm.toFixed(0)} WPM` : "—"}
              </span>
            </div>
            {avgWpm > 0 && (
              <div className="vm-bar-track">
                <div
                  className="vm-bar-fill"
                  style={{
                    width: `${Math.min(100, (avgWpm / 200) * 100)}%`,
                    background:
                      avgWpm >= 120 && avgWpm <= 150
                        ? "var(--green)"
                        : avgWpm > 170
                          ? "var(--red)"
                          : "var(--yellow)",
                  }}
                />
                {/* Ideal zone indicator */}
                <div className="vm-ideal-zone" style={{ left: "60%", width: "15%" }} />
              </div>
            )}
          </div>

          {/* Fillers */}
          <div className="voice-metric">
            <div className="vm-top">
              <AlertTriangle size={12} />
              <span className="vm-name">Fillers</span>
              <span className={`vm-value ${totalFillers === 0 ? "green" : totalFillers <= 3 ? "yellow" : "red"}`}>
                {totalFillers}
              </span>
            </div>
            {latestVoice && latestVoice.fillers_found.length > 0 && (
              <div className="vm-detail">
                Last: {latestVoice.fillers_found.join(", ")}
              </div>
            )}
          </div>

          {/* Jargon */}
          <div className="voice-metric">
            <div className="vm-top">
              <Shield size={12} />
              <span className="vm-name">Jargon</span>
              <span className={`vm-value ${totalJargon === 0 ? "green" : totalJargon <= 2 ? "yellow" : "red"}`}>
                {totalJargon}
              </span>
            </div>
            {latestVoice && latestVoice.jargon_found.length > 0 && (
              <div className="vm-detail">
                Last: {latestVoice.jargon_found.join(", ")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Turn-by-turn mini chart */}
      <div className="sidebar-card">
        <div className="sidebar-card-label">Turn Performance</div>
        {voiceAnalyses.length === 0 ? (
          <p className="sidebar-empty">Speak to see metrics</p>
        ) : (
          <div className="turn-timeline">
            {voiceAnalyses.map((v, i) => {
              const commScore = scores[i]
                ? (scores[i].empathy_score + scores[i].spikes_score) / 2
                : 0.5;
              const combined = (commScore + v.delivery_score) / 2;
              const color = getScoreColor(combined);
              return (
                <div key={i} className={`turn-pip ${color}`}>
                  <div className="pip-bar" style={{ height: `${combined * 100}%` }} />
                  <span className="pip-label">T{i + 1}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
