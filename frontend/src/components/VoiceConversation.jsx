import React, { useState, useRef, useEffect, useCallback } from "react";
import VoiceScorePanel from "./VoiceScorePanel";
import useVisionAnalysis from "../hooks/useVisionAnalysis";
import {
  Square,
  UserRound,
  Stethoscope,
  Volume2,
  VolumeX,
  Radio,
  Camera,
  CameraOff,
  Eye,
} from "lucide-react";

/* ─── helpers ─── */
function formatPatientText(text) {
  return text.split(/(\*[^*]+\*)/).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") ? (
      <em key={i} className="action-text">{part}</em>
    ) : (
      part
    )
  );
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  const prefs = ["Microsoft Jenny", "Google UK English Female", "Samantha", "Karen", "Zira"];
  for (const p of prefs) {
    const v = voices.find((v) => v.name.includes(p));
    if (v) return v;
  }
  return (
    voices.find((v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    voices[0]
  );
}

/* ─── component ─── */
export default function VoiceConversation({ session, onEndSession }) {
  const [messages, setMessages] = useState([
    { role: "patient", content: session.opening_line },
  ]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [interim, setInterim] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [scores, setScores] = useState([]);
  const [voiceAnalyses, setVoiceAnalyses] = useState([]);
  const [emotionalState, setEmotionalState] = useState("calm");
  const [connected, setConnected] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // Vision analysis — webcam emotion + posture detection
  const { videoRef, canvasRef, ready: visionReady, error: visionError, visionData, getSnapshot } = useVisionAnalysis(cameraEnabled);

  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const speechStartRef = useRef(0);
  const lastResponseRef = useRef(Date.now());
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const ttsEnabledRef = useRef(true);
  const emotionalStateRef = useRef("calm");
  const isEndingRef = useRef(false);
  const getSnapshotRef = useRef(getSnapshot);
  useEffect(() => { getSnapshotRef.current = getSnapshot; }, [getSnapshot]);

  // Keep refs in sync for use inside callbacks that capture stale closures
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { emotionalStateRef.current = emotionalState; }, [emotionalState]);
  useEffect(() => { isEndingRef.current = isEnding; }, [isEnding]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interim]);

  /* ─── TTS ─── */
  const speakText = useCallback((text, onDone) => {
    const cleanText = text.replace(/\*[^*]+\*/g, "... ");
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;

    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const emo = emotionalStateRef.current;
    if (emo === "distressed" || emo === "angry") {
      utterance.rate = 1.05; utterance.pitch = 1.1;
    } else if (emo === "withdrawn" || emo === "numb") {
      utterance.rate = 0.8; utterance.pitch = 0.9; utterance.volume = 0.8;
    } else if (emo === "shocked") {
      utterance.rate = 0.75;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (onDone) onDone();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  /* ─── WebSocket ─── */
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/voice/${session.session_id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "processing") {
        setIsProcessing(true);
      } else if (data.type === "response") {
        setIsProcessing(false);
        lastResponseRef.current = Date.now();

        setMessages((prev) => [
          ...prev,
          { role: "patient", content: data.patient_response },
        ]);
        setEmotionalState(data.emotional_state || "engaged");

        if (data.scores) setScores((prev) => [...prev, data.scores]);
        if (data.voice_analysis) setVoiceAnalyses((prev) => [...prev, data.voice_analysis]);

        if (ttsEnabledRef.current) {
          speakText(data.patient_response);
        }
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => { ws.close(); };
  }, [session.session_id, speakText]);

  /* ─── Continuous Speech Recognition ─── */
  const createRecognition = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition not supported. Use Chrome or Edge.");
      return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (interimText) setInterim(interimText);

      if (finalText) {
        setInterim("");
        const now = Date.now();
        const duration = now - (speechStartRef.current || now);
        const pauseBefore = (speechStartRef.current || now) - lastResponseRef.current;

        setMessages((prev) => [...prev, { role: "clinician", content: finalText }]);

        // Send to backend with vision snapshot
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const vision = getSnapshotRef.current();
          wsRef.current.send(JSON.stringify({
            type: "utterance",
            text: finalText,
            speech_duration_ms: Math.max(duration, 500),
            pause_before_ms: Math.max(0, pauseBefore),
            was_interrupted: isSpeakingRef.current,
            vision: vision,
          }));
        }

        // Interrupt patient TTS if user speaks over them
        if (isSpeakingRef.current) {
          window.speechSynthesis.cancel();
          setIsSpeaking(false);
        }

        speechStartRef.current = 0;
      }
    };

    recognition.onspeechstart = () => {
      if (!speechStartRef.current) speechStartRef.current = Date.now();
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.error("Speech recognition error:", event.error);
    };

    // Auto-restart on end — this is the key to "always on" mode
    recognition.onend = () => {
      if (isEndingRef.current) return;
      // Restart immediately — never stop listening
      try {
        recognition.start();
      } catch {
        // Small delay then retry if start fails (e.g. already started)
        setTimeout(() => {
          try { recognition.start(); } catch { /* give up this cycle */ }
        }, 200);
      }
    };

    return recognition;
  }, []);

  // Start listening automatically when component mounts + WS connects
  useEffect(() => {
    if (!connected) return;

    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    setMicActive(true);

    // Speak opening line first, then start listening
    if (ttsEnabled && session.opening_line) {
      speakText(session.opening_line, () => {
        try { recognition.start(); } catch { /* ignore */ }
      });
    } else {
      try { recognition.start(); } catch { /* ignore */ }
    }

    return () => {
      setMicActive(false);
      try { recognition.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    };
  }, [connected, createRecognition, speakText, session.opening_line, ttsEnabled]);

  /* ─── End session ─── */
  const handleEnd = async () => {
    setIsEnding(true);

    // Stop recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setMicActive(false);
    window.speechSynthesis.cancel();

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end" }));
    }

    try {
      const res = await fetch("/api/session/end/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.session_id }),
      });
      const debrief = await res.json();
      onEndSession(debrief);
    } catch {
      alert("Failed to generate debrief.");
      setIsEnding(false);
    }
  };

  /* ─── Render ─── */
  return (
    <div className="conv-layout">
      <div className="conv-panel voice-panel">
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
          <div className="voice-topbar-right">
            <div className={`connection-dot ${connected ? "connected" : ""}`} />
            <button
              className="btn-tts-toggle"
              onClick={() => setCameraEnabled(!cameraEnabled)}
              aria-label={cameraEnabled ? "Disable camera" : "Enable camera"}
              title={cameraEnabled ? "Camera on" : "Camera off"}
            >
              {cameraEnabled ? <Camera size={15} /> : <CameraOff size={15} />}
            </button>
            <button
              className="btn-tts-toggle"
              onClick={() => {
                setTtsEnabled(!ttsEnabled);
                if (ttsEnabled) window.speechSynthesis.cancel();
              }}
              aria-label={ttsEnabled ? "Mute patient voice" : "Unmute patient voice"}
            >
              {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button
              className="btn btn-end"
              onClick={handleEnd}
              disabled={isEnding || messages.length < 2}
            >
              <Square size={14} />
              {isEnding ? "Generating..." : "End Session"}
            </button>
          </div>
        </div>

        <div className="conv-role-banner">
          <Stethoscope size={14} />
          <span>{session.clinician_role}</span>
        </div>

        {/* Live transcript */}
        <div className="conv-messages" role="log" aria-live="polite">
          {messages.map((msg, i) => (
            <div key={i} className={`msg msg-${msg.role}`}>
              <div className={`msg-avatar ${msg.role === "patient" ? "patient-avatar" : "clinician-avatar"}`}>
                {msg.role === "patient" ? <UserRound size={16} /> : <Stethoscope size={16} />}
              </div>
              <div className="msg-body">
                <span className="msg-sender">
                  {msg.role === "patient" ? session.patient_name : "You"}
                </span>
                <div className="msg-content">
                  {msg.role === "patient" ? formatPatientText(msg.content) : msg.content}
                </div>
              </div>
            </div>
          ))}

          {interim && (
            <div className="msg msg-clinician">
              <div className="msg-avatar clinician-avatar">
                <Stethoscope size={16} />
              </div>
              <div className="msg-body">
                <span className="msg-sender">You</span>
                <div className="msg-content interim">{interim}...</div>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="msg msg-patient">
              <div className="msg-avatar patient-avatar">
                <UserRound size={16} />
              </div>
              <div className="msg-body">
                <span className="msg-sender">{session.patient_name}</span>
                <div className="msg-content">
                  <div className="typing-dots"><span /><span /><span /></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Always-on status bar — no mic button needed */}
        <div className="voice-status-bar">
          <div className={`voice-live-indicator ${micActive ? "active" : ""}`}>
            <div className="live-dot" />
            <Radio size={13} />
            <span>{micActive ? "Live" : "Connecting..."}</span>
          </div>

          {isSpeaking && (
            <div className="voice-live-indicator speaking">
              <Volume2 size={13} />
              <span>Patient speaking</span>
            </div>
          )}

          {isProcessing && (
            <div className="voice-live-indicator processing">
              <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
              <span>Thinking</span>
            </div>
          )}

          {micActive && !isSpeaking && !isProcessing && !interim && (
            <span className="voice-hint">Just speak naturally — the mic is always on</span>
          )}

          {interim && (
            <span className="voice-hint hearing">Hearing you...</span>
          )}
        </div>
      </div>

      <div className="voice-right-col">
        {/* Webcam preview */}
        {cameraEnabled && (
          <div className="webcam-card">
            <div className="webcam-container">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="webcam-video"
              />
              <canvas ref={canvasRef} className="webcam-overlay" />

              {/* Live emotion + posture badges */}
              {visionReady && visionData.faceDetected && (
                <div className="vision-badges">
                  <span className={`vision-badge emotion-${visionData.emotion}`}>
                    <Eye size={10} />
                    {visionData.emotion}
                  </span>
                  {visionData.bodyDetected && visionData.posture !== "unknown" && (
                    <span className={`vision-badge posture-${visionData.posture}`}>
                      {visionData.posture}
                    </span>
                  )}
                </div>
              )}

              {!visionReady && !visionError && (
                <div className="webcam-loading">
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 1.5 }} />
                  <span>Loading vision...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <VoiceScorePanel
          scores={scores}
          voiceAnalyses={voiceAnalyses}
          emotionalState={emotionalState}
          isListening={micActive}
          isSpeaking={isSpeaking}
          visionData={cameraEnabled ? visionData : null}
        />
      </div>
    </div>
  );
}
