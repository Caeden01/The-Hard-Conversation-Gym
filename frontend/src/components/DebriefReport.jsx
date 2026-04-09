import React, { useState } from "react";
import BranchReplay from "./BranchReplay";
import {
  Award,
  AlertCircle,
  TrendingUp,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Heart,
  Shield,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";

function getScoreColor(score) {
  if (score >= 0.7) return "green";
  if (score >= 0.4) return "yellow";
  return "red";
}

const SPIKES_LABELS = {
  S: { name: "Setting", desc: "Environment & comfort" },
  P: { name: "Perception", desc: "What patient knows" },
  I: { name: "Invitation", desc: "Readiness for info" },
  K: { name: "Knowledge", desc: "Delivering the news" },
  E: { name: "Emotions", desc: "Empathy & silence" },
  S2: { name: "Strategy", desc: "Next steps & plan" },
};

export default function DebriefReport({ debrief, session, onBack }) {
  const [replayNode, setReplayNode] = useState(null);
  const [expandedTurn, setExpandedTurn] = useState(null);

  const ai = debrief.ai_debrief || {};

  const empathyPct = (debrief.overall_empathy_score * 100).toFixed(0);
  const spikesPct = (debrief.overall_spikes_score * 100).toFixed(0);

  return (
    <div className="debrief-page">
      {/* Back nav */}
      <button className="debrief-back" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>New Scenario</span>
      </button>

      {/* Hero banner */}
      <section className="debrief-hero">
        <div className="debrief-hero-text">
          <h2>Session Complete</h2>
          <p className="debrief-scenario">{debrief.scenario_title}</p>
          {ai.overall_assessment && (
            <p className="debrief-assessment">{ai.overall_assessment}</p>
          )}
        </div>

        {/* Score cards row */}
        <div className="score-trio">
          <div className="score-big-card">
            <Heart size={20} className="score-icon" />
            <div className="score-big-value" style={{ color: empathyPct >= 70 ? "#22C55E" : empathyPct >= 40 ? "#EAB308" : "#EF4444" }}>
              {empathyPct}%
            </div>
            <div className="score-big-label">Empathy</div>
            {ai.empathy_rating && (
              <div className={`score-rating ${ai.empathy_rating}`}>
                {ai.empathy_rating.replace("_", " ")}
              </div>
            )}
          </div>
          <div className="score-big-card">
            <Shield size={20} className="score-icon" />
            <div className="score-big-value" style={{ color: spikesPct >= 70 ? "#22C55E" : spikesPct >= 40 ? "#EAB308" : "#EF4444" }}>
              {spikesPct}%
            </div>
            <div className="score-big-label">SPIKES</div>
            {ai.spikes_rating && (
              <div className={`score-rating ${ai.spikes_rating}`}>
                {ai.spikes_rating.replace("_", " ")}
              </div>
            )}
          </div>
          <div className="score-big-card">
            <MessageSquare size={20} className="score-icon" />
            <div className="score-big-value" style={{ color: "#0891B2" }}>
              {debrief.total_turns}
            </div>
            <div className="score-big-label">Turns</div>
            <div className="score-rating" style={{ color: "#5F8A85" }}>exchanges</div>
          </div>
        </div>
      </section>

      {/* Two-column feedback */}
      <section className="debrief-feedback-row">
        {ai.done_well && ai.done_well.length > 0 && (
          <div className="feedback-card done-well">
            <div className="feedback-card-header green">
              <CheckCircle2 size={18} />
              <h3>What You Did Well</h3>
            </div>
            {ai.done_well.map((item, i) => (
              <div key={i} className="feedback-entry">
                <div className="feedback-point">{item.point}</div>
                {item.example && (
                  <div className="feedback-quote">"{item.example}"</div>
                )}
              </div>
            ))}
          </div>
        )}

        {ai.to_improve && ai.to_improve.length > 0 && (
          <div className="feedback-card to-improve">
            <div className="feedback-card-header orange">
              <TrendingUp size={18} />
              <h3>Areas to Improve</h3>
            </div>
            {ai.to_improve.map((item, i) => (
              <div key={i} className="feedback-entry">
                <div className="feedback-point">{item.point}</div>
                {item.example && (
                  <div className="feedback-quote">You said: "{item.example}"</div>
                )}
                {item.better_alternative && (
                  <div className="feedback-alt">
                    Try: "{item.better_alternative}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SPIKES Breakdown */}
      {ai.spikes_breakdown && Object.keys(ai.spikes_breakdown).length > 0 && (
        <section className="debrief-section">
          <h3 className="section-title">
            <Shield size={18} />
            SPIKES Framework Breakdown
          </h3>
          <div className="spikes-row">
            {Object.entries(SPIKES_LABELS).map(([key, meta]) => {
              const data = ai.spikes_breakdown[key] || {};
              const addressed = data.addressed;
              return (
                <div key={key} className={`spikes-cell ${addressed ? "addressed" : "missed"}`}>
                  <div className="spikes-cell-top">
                    <span className="spikes-letter">{key === "S2" ? "S" : key}</span>
                    {addressed ? (
                      <CheckCircle2 size={14} className="spikes-check green" />
                    ) : (
                      <XCircle size={14} className="spikes-check muted" />
                    )}
                  </div>
                  <div className="spikes-cell-name">{meta.name}</div>
                  {data.score !== undefined && (
                    <div className="spikes-mini-bar">
                      <div
                        className={`spikes-mini-fill ${getScoreColor(data.score)}`}
                        style={{ width: `${data.score * 100}%` }}
                      />
                    </div>
                  )}
                  {data.note && <div className="spikes-cell-note">{data.note}</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Turning Points */}
      {debrief.turning_points && debrief.turning_points.length > 0 && (
        <section className="debrief-section">
          <h3 className="section-title">
            <AlertCircle size={18} />
            Turning Points
          </h3>
          <div className="tp-list">
            {debrief.turning_points.map((tp, i) => (
              <div key={i} className={`tp-card ${tp.type}`}>
                <div className="tp-badge">
                  {tp.type === "positive" ? (
                    <TrendingUp size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  Turn {tp.turn}
                </div>
                <div className="tp-body">
                  {Array.isArray(tp.reason) ? tp.reason.join("; ") : tp.reason}
                </div>
                {tp.suggested_alternative && (
                  <div className="tp-alt">Better: "{tp.suggested_alternative}"</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Conversation Timeline */}
      {debrief.timeline && debrief.timeline.length > 0 && (
        <section className="debrief-section">
          <h3 className="section-title">
            <MessageSquare size={18} />
            Conversation Timeline
          </h3>
          <div className="timeline-list">
            {debrief.timeline.map((turn, i) => {
              const avg = (turn.empathy_score + turn.spikes_score) / 2;
              const color = getScoreColor(avg);
              const isExpanded = expandedTurn === i;

              return (
                <div key={i} className={`tl-row ${color}`}>
                  <div className="tl-left">
                    <div className={`tl-num ${color}`}>{turn.turn}</div>
                    <div className="tl-line" />
                  </div>
                  <div className="tl-content">
                    <div
                      className="tl-header"
                      onClick={() => setExpandedTurn(isExpanded ? null : i)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="tl-preview">
                        <strong>You:</strong> {turn.clinician.slice(0, 80)}
                        {turn.clinician.length > 80 ? "..." : ""}
                      </div>
                      <div className="tl-header-right">
                        <span className={`tl-pct ${color}`}>
                          {(avg * 100).toFixed(0)}%
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="tl-expanded">
                        <div className="tl-exchange">
                          <div className="tl-utterance you">
                            <strong>You:</strong> "{turn.clinician}"
                          </div>
                          <div className="tl-utterance patient">
                            <strong>Patient:</strong> "{turn.patient}"
                          </div>
                        </div>

                        <div className="tl-meta-row">
                          <span>Empathy: {(turn.empathy_score * 100).toFixed(0)}%</span>
                          <span>SPIKES: {(turn.spikes_score * 100).toFixed(0)}%</span>
                          <span>Tone: {turn.tone}</span>
                          <span>State: {turn.emotional_state}</span>
                        </div>

                        <div className="tl-flags">
                          {(turn.red_flags || []).map((flag, j) => (
                            <span key={`r${j}`} className="flag red">
                              {flag}
                            </span>
                          ))}
                          {(turn.strengths || []).map((s, j) => (
                            <span key={`s${j}`} className="flag green">
                              {s}
                            </span>
                          ))}
                        </div>

                        {turn.suggested_alternative && (
                          <div className="tl-alt">
                            <div className="tl-alt-label">Better alternative</div>
                            "{turn.suggested_alternative}"
                          </div>
                        )}

                        <button
                          className="btn btn-replay"
                          onClick={() =>
                            setReplayNode({
                              nodeId: turn.node_id,
                              turnNumber: turn.turn,
                              originalUtterance: turn.clinician,
                            })
                          }
                        >
                          <RotateCcw size={14} />
                          Replay from here
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Emotional Arc */}
      {ai.emotional_arc && (
        <section className="debrief-section">
          <h3 className="section-title">
            <Heart size={18} />
            Emotional Arc
          </h3>
          <p className="arc-text">{ai.emotional_arc}</p>
        </section>
      )}

      {/* Footer CTA */}
      <div className="debrief-footer">
        <button className="btn btn-primary btn-lg" onClick={onBack}>
          Start New Scenario
        </button>
      </div>

      {/* Replay Modal */}
      {replayNode && (
        <BranchReplay
          sessionId={session.session_id}
          nodeId={replayNode.nodeId}
          turnNumber={replayNode.turnNumber}
          originalUtterance={replayNode.originalUtterance}
          onClose={() => setReplayNode(null)}
        />
      )}
    </div>
  );
}
