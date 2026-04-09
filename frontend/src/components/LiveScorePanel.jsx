import React from "react";
import { Heart, Shield, TrendingUp, TrendingDown, Minus } from "lucide-react";

function getScoreColor(score) {
  if (score >= 0.7) return "green";
  if (score >= 0.4) return "yellow";
  return "red";
}

function getTrendIcon(scores, key) {
  if (scores.length < 2) return <Minus size={12} />;
  const curr = scores[scores.length - 1][key];
  const prev = scores[scores.length - 2][key];
  if (curr > prev + 0.05) return <TrendingUp size={12} />;
  if (curr < prev - 0.05) return <TrendingDown size={12} />;
  return <Minus size={12} />;
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

export default function LiveScorePanel({ scores, emotionalState }) {
  const latest = scores.length > 0 ? scores[scores.length - 1] : null;

  const avgEmpathy =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + s.empathy_score, 0) / scores.length
      : 0;

  const avgSpikes =
    scores.length > 0
      ? scores.reduce((sum, s) => sum + s.spikes_score, 0) / scores.length
      : 0;

  const emoConfig = EMOTIONAL_CONFIG[emotionalState] || EMOTIONAL_CONFIG.calm;

  return (
    <aside className="score-sidebar" aria-label="Live scoring panel">
      {/* Patient Emotional State */}
      <div className="sidebar-card">
        <div className="sidebar-card-label">Patient Emotional State</div>
        <div
          className="emotional-badge"
          style={{ background: emoConfig.bg, color: emoConfig.color }}
        >
          <div
            className="emo-pulse"
            style={{ background: emoConfig.color }}
          />
          <span>{emotionalState}</span>
        </div>
      </div>

      {/* Empathy Gauge */}
      <div className="sidebar-card">
        <div className="sidebar-card-label">
          <Heart size={13} />
          Empathy
        </div>
        <div className="gauge-container">
          <svg viewBox="0 0 120 70" className="gauge-svg">
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke={
                avgEmpathy >= 0.7
                  ? "#22C55E"
                  : avgEmpathy >= 0.4
                    ? "#EAB308"
                    : "#EF4444"
              }
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${avgEmpathy * 157} 157`}
              style={{ transition: "stroke-dasharray 600ms ease" }}
            />
          </svg>
          <div className="gauge-value">
            {(avgEmpathy * 100).toFixed(0)}
            <span className="gauge-percent">%</span>
          </div>
        </div>
        <div className={`gauge-trend ${getScoreColor(avgEmpathy)}`}>
          {getTrendIcon(scores, "empathy_score")}
          <span>
            {scores.length > 0
              ? latest.empathy_score >= 0.7
                ? "Good empathy"
                : latest.empathy_score >= 0.4
                  ? "Room to improve"
                  : "Needs attention"
              : "Waiting..."}
          </span>
        </div>
      </div>

      {/* SPIKES Gauge */}
      <div className="sidebar-card">
        <div className="sidebar-card-label">
          <Shield size={13} />
          SPIKES Protocol
        </div>
        <div className="gauge-container">
          <svg viewBox="0 0 120 70" className="gauge-svg">
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke={
                avgSpikes >= 0.7
                  ? "#22C55E"
                  : avgSpikes >= 0.4
                    ? "#EAB308"
                    : "#EF4444"
              }
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${avgSpikes * 157} 157`}
              style={{ transition: "stroke-dasharray 600ms ease" }}
            />
          </svg>
          <div className="gauge-value">
            {(avgSpikes * 100).toFixed(0)}
            <span className="gauge-percent">%</span>
          </div>
        </div>
        <div className={`gauge-trend ${getScoreColor(avgSpikes)}`}>
          {getTrendIcon(scores, "spikes_score")}
          <span>
            {scores.length > 0
              ? latest.spikes_step && latest.spikes_step !== "none"
                ? `Addressed: ${latest.spikes_step}`
                : "No step addressed"
              : "Waiting..."}
          </span>
        </div>
      </div>

      {/* Turn Timeline */}
      <div className="sidebar-card">
        <div className="sidebar-card-label">Turn History</div>
        {scores.length === 0 ? (
          <p className="sidebar-empty">
            Scores appear after your first response
          </p>
        ) : (
          <div className="turn-timeline">
            {scores.map((s, i) => {
              const avg = (s.empathy_score + s.spikes_score) / 2;
              const color = getScoreColor(avg);
              return (
                <div key={i} className={`turn-pip ${color}`}>
                  <div className="pip-bar" style={{ height: `${avg * 100}%` }} />
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
