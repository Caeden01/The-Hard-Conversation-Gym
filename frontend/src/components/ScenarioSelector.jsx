import React, { useState, useEffect } from "react";
import { fetchScenarios, startSession } from "../api/client";
import {
  Clock,
  User,
  AlertTriangle,
  ChevronRight,
  Activity,
  Heart,
  Shield,
  BookOpen,
  Zap,
  Target,
  Mic,
  MessageSquare,
} from "lucide-react";

const DIFFICULTY_CONFIG = {
  1: { label: "Beginner", color: "green" },
  2: { label: "Easy", color: "green" },
  3: { label: "Intermediate", color: "yellow" },
  4: { label: "Advanced", color: "orange" },
  5: { label: "Expert", color: "red" },
};

const SCENARIO_ICONS = {
  pancreatic_cancer: Activity,
  surgery_death: AlertTriangle,
  treatment_failure: Heart,
  child_diagnosis: Shield,
  elderly_decline: BookOpen,
  mental_health_crisis: Zap,
};

export default function ScenarioSelector({ onStartSession, mode, onModeChange }) {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchScenarios()
      .then(setScenarios)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (scenarioId) => {
    setStarting(scenarioId);
    try {
      const session = await startSession(scenarioId);
      onStartSession(session);
    } catch (e) {
      setError(e.message);
      setStarting(null);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Loading scenarios...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <AlertTriangle size={40} />
        <h3>Unable to connect</h3>
        <p>Make sure the backend is running at http://localhost:8002</p>
        <p className="error-detail">{error}</p>
      </div>
    );
  }

  return (
    <div className="scenario-page">
      {/* Hero section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Target size={14} />
            <span>Practice Mode</span>
          </div>
          <h2>Choose Your Scenario</h2>
          <p>
            Practice delivering difficult news in a safe environment. Each
            scenario is scored against the SPIKES protocol and evaluated for
            empathy in real time.
          </p>

          {/* Mode toggle */}
          <div className="mode-toggle" role="radiogroup" aria-label="Interaction mode">
            <button
              className={`mode-btn ${mode === "voice" ? "active" : ""}`}
              onClick={() => onModeChange("voice")}
              role="radio"
              aria-checked={mode === "voice"}
            >
              <Mic size={16} />
              <span>Voice Mode</span>
            </button>
            <button
              className={`mode-btn ${mode === "text" ? "active" : ""}`}
              onClick={() => onModeChange("text")}
              role="radio"
              aria-checked={mode === "text"}
            >
              <MessageSquare size={16} />
              <span>Text Mode</span>
            </button>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat-card glass">
            <span className="stat-number">{scenarios.length}</span>
            <span className="stat-label">Scenarios</span>
          </div>
          <div className="stat-card glass">
            <span className="stat-number">6</span>
            <span className="stat-label">SPIKES Steps</span>
          </div>
          <div className="stat-card glass">
            <span className="stat-number">3</span>
            <span className="stat-label">AI Branches</span>
          </div>
        </div>
      </section>

      {/* Scenario bento grid */}
      <section className="scenario-bento" aria-label="Available scenarios">
        {scenarios.map((s, i) => {
          const Icon = SCENARIO_ICONS[s.id] || Activity;
          const diff = DIFFICULTY_CONFIG[s.difficulty] || DIFFICULTY_CONFIG[3];
          const isFirst = i < 2;

          return (
            <article
              key={s.id}
              className={`bento-card ${isFirst ? "bento-featured" : ""} ${starting === s.id ? "loading" : ""}`}
              onClick={() => !starting && handleSelect(s.id)}
              onKeyDown={(e) =>
                e.key === "Enter" && !starting && handleSelect(s.id)
              }
              tabIndex={0}
              role="button"
              aria-label={`Start scenario: ${s.title}`}
              style={{ opacity: starting && starting !== s.id ? 0.5 : 1 }}
            >
              {starting === s.id && (
                <div className="card-loading-overlay">
                  <div className="spinner" />
                </div>
              )}

              <div className="bento-card-header">
                <div className={`bento-icon ${diff.color}`}>
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <div className={`difficulty-pill ${diff.color}`}>
                  {diff.label}
                </div>
              </div>

              <h3>{s.title}</h3>
              <p className="bento-description">{s.description}</p>

              <div className="bento-meta">
                <div className="meta-item">
                  <User size={14} />
                  <span>
                    {s.patient_name}, {s.patient_age}
                  </span>
                </div>
                <div className="meta-item">
                  <Clock size={14} />
                  <span>~{s.estimated_minutes} min</span>
                </div>
              </div>

              <div className="bento-skills">
                {s.skills_tested.map((skill, j) => (
                  <span key={j} className="skill-chip">
                    {skill}
                  </span>
                ))}
              </div>

              <div className="bento-cta">
                <span>Start Practice</span>
                <ChevronRight size={16} />
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
