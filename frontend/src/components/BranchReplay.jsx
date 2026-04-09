import React, { useState } from "react";
import { replayBranch } from "../api/client";
import { X, RotateCcw, Send } from "lucide-react";

export default function BranchReplay({ sessionId, nodeId, turnNumber, originalUtterance, onClose }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleReplay = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await replayBranch(sessionId, nodeId, input.trim());
      setResult(res);
    } catch {
      alert("Replay failed. The session may have expired.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReplay();
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" role="dialog" aria-label={`Replay turn ${turnNumber}`}>
        <div className="modal-header">
          <div className="modal-header-left">
            <RotateCcw size={18} />
            <h3>Replay Turn {turnNumber}</h3>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="modal-desc">
          Try a different approach and see how the patient responds.
        </p>

        <div className="modal-original">
          <div className="modal-original-label">Your original response</div>
          <div className="modal-original-text">"{originalUtterance}"</div>
        </div>

        <div className="modal-input-area">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Try a different response..."
            rows={3}
            disabled={loading}
            aria-label="Alternative response"
          />
          <button
            className="btn btn-primary"
            onClick={handleReplay}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            ) : (
              <>
                <Send size={14} />
                Try This
              </>
            )}
          </button>
        </div>

        {result && (
          <div className="modal-result">
            <div className="modal-result-label">Patient would respond:</div>
            <div className="modal-result-text">{result.patient_response}</div>
            <div className="modal-result-scores">
              <div className="modal-score-chip">
                Empathy:{" "}
                <strong style={{ color: result.empathy_score >= 0.7 ? "#22C55E" : result.empathy_score >= 0.4 ? "#EAB308" : "#EF4444" }}>
                  {(result.empathy_score * 100).toFixed(0)}%
                </strong>
              </div>
              <div className="modal-score-chip">
                SPIKES:{" "}
                <strong style={{ color: result.spikes_score >= 0.7 ? "#22C55E" : result.spikes_score >= 0.4 ? "#EAB308" : "#EF4444" }}>
                  {(result.spikes_score * 100).toFixed(0)}%
                </strong>
              </div>
              <div className="modal-score-chip">
                State: <strong>{result.emotional_state}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
