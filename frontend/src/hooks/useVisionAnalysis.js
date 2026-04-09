/**
 * useVisionAnalysis — Real-time facial emotion + posture detection
 *
 * Uses SSD MobileNet (more accurate than TinyFaceDetector) + face landmarks
 * for better expression detection. Applies temporal smoothing to avoid
 * flickering between frames.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// ─── Posture classification from MediaPipe landmarks ───
function classifyPosture(landmarks) {
  if (!landmarks || landmarks.length < 33) return { posture: "unknown", signals: [], details: {} };

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const hipMidY = (leftHip.y + rightHip.y) / 2;

  const headTilt = nose.x - shoulderMidX;
  const headDrop = nose.y - shoulderMidY;
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const torsoLean = shoulderMidY - hipMidY;

  const leftWristToRightShoulder = Math.hypot(leftWrist.x - rightShoulder.x, leftWrist.y - rightShoulder.y);
  const rightWristToLeftShoulder = Math.hypot(rightWrist.x - leftShoulder.x, rightWrist.y - leftShoulder.y);
  const armsCrossed = leftWristToRightShoulder < 0.15 && rightWristToLeftShoulder < 0.15;

  const signals = [];
  if (armsCrossed) signals.push("arms_crossed");
  if (headDrop > 0.22) signals.push("head_down");
  if (Math.abs(headTilt) > 0.06) signals.push(headTilt < 0 ? "head_tilted_left" : "head_tilted_right");
  if (torsoLean > -0.15) signals.push("leaning_forward");
  if (shoulderWidth < 0.12) signals.push("shoulders_hunched");

  let posture = "open";
  if (armsCrossed) posture = "defensive";
  else if (headDrop > 0.22) posture = "disengaged";
  else if (torsoLean > -0.15) posture = "engaged";
  else if (shoulderWidth < 0.12) posture = "tense";

  return {
    posture,
    signals,
    details: {
      head_tilt: Math.round(headTilt * 100) / 100,
      head_drop: Math.round(headDrop * 100) / 100,
      shoulder_width: Math.round(shoulderWidth * 100) / 100,
      arms_crossed: armsCrossed,
      torso_lean: Math.round(torsoLean * 100) / 100,
    },
  };
}

// ─── Emotion from face-api with aggressive neutral suppression ───
//
// The FER2013-trained model outputs ~60-95% neutral for most real webcam faces.
// We redistribute neutral's probability mass to make real emotions visible.
//
function getDominantEmotion(expressions) {
  if (!expressions) return { emotion: "neutral", confidence: 0, all: {} };

  const raw = { ...expressions };
  const neutralRaw = raw.neutral || 0;

  // Step 1: Redistribute — steal 60% of neutral's score and spread it
  // proportionally across the non-neutral emotions. This simulates what
  // a better-calibrated model would output.
  const stealRatio = 0.6;
  const stolen = neutralRaw * stealRatio;
  const nonNeutralEntries = Object.entries(raw).filter(([k]) => k !== "neutral");
  const nonNeutralSum = nonNeutralEntries.reduce((s, [, v]) => s + v, 0) || 1;

  const adjusted = {};
  for (const [k, v] of nonNeutralEntries) {
    adjusted[k] = v + (stolen * (v / nonNeutralSum));
  }
  adjusted.neutral = neutralRaw * (1 - stealRatio);

  // Step 2: Normalize to sum to 1
  const total = Object.values(adjusted).reduce((s, v) => s + v, 0) || 1;
  for (const k of Object.keys(adjusted)) {
    adjusted[k] = adjusted[k] / total;
  }

  // Step 3: Pick winner
  const sorted = Object.entries(adjusted).sort((a, b) => b[1] - a[1]);
  const emotion = sorted[0][0];
  const confidence = sorted[0][1];

  const all = Object.fromEntries(
    sorted.map(([k, v]) => [k, Math.round(v * 100) / 100])
  );

  // Also return top 3 for display
  const top3 = sorted.slice(0, 3).map(([k, v]) => ({
    emotion: k,
    score: Math.round(v * 100),
  }));

  return { emotion, confidence: Math.round(confidence * 100) / 100, all, top3 };
}

// ─── Temporal smoothing — averages emotion over last N frames ───
class EmotionSmoother {
  constructor(windowSize = 6) {
    this.window = [];
    this.windowSize = windowSize;
  }

  push(emotionResult) {
    this.window.push(emotionResult);
    if (this.window.length > this.windowSize) this.window.shift();
  }

  get() {
    if (this.window.length === 0) return { emotion: "neutral", confidence: 0, all: {}, top3: [] };

    // Count votes for each emotion across the window
    const votes = {};
    const confidences = {};

    for (const frame of this.window) {
      const emo = frame.emotion;
      votes[emo] = (votes[emo] || 0) + 1;
      confidences[emo] = Math.max(confidences[emo] || 0, frame.confidence);
    }

    // Winner is the most frequent emotion in the window
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    const winner = sorted[0][0];

    const latest = this.window[this.window.length - 1];

    return {
      emotion: winner,
      confidence: confidences[winner],
      all: latest.all,
      top3: latest.top3 || [],
    };
  }
}

// ─── Hook ───
export default function useVisionAnalysis(enabled = true) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [visionData, setVisionData] = useState({
    emotion: "neutral",
    emotionConfidence: 0,
    allEmotions: {},
    top3: [],
    posture: "unknown",
    postureSignals: [],
    postureDetails: {},
    faceDetected: false,
    bodyDetected: false,
  });

  const faceApiLoaded = useRef(false);
  const poseLandmarkerRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const smootherRef = useRef(new EmotionSmoother(6));

  // Initialize models
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function init() {
      try {
        // Load face-api models — use SSD MobileNet for better accuracy
        if (!faceApiLoaded.current) {
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
            faceapi.nets.faceExpressionNet.loadFromUri("/models"),
          ]);
          faceApiLoaded.current = true;
        }

        // Load MediaPipe Pose
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        poseLandmarkerRef.current = poseLandmarker;

        // Get webcam — higher resolution for better face detection
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        streamRef.current = stream;

        if (videoRef.current && !cancelled) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        console.error("Vision init error:", err);
        setError(err.message || "Failed to initialize vision");
      }
    }

    init();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }
    };
  }, [enabled]);

  // Analysis loop — ~6fps for SSD (heavier model)
  useEffect(() => {
    if (!ready || !enabled) return;

    let lastRun = 0;
    const interval = 160; // ms (~6fps — SSD is heavier than TinyFaceDetector)

    async function analyze() {
      const now = performance.now();
      if (now - lastRun < interval) {
        animFrameRef.current = requestAnimationFrame(analyze);
        return;
      }
      lastRun = now;

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(analyze);
        return;
      }

      let emotionResult = { emotion: "neutral", confidence: 0, all: {} };
      let postureResult = { posture: "unknown", signals: [], details: {} };
      let faceDetected = false;
      let bodyDetected = false;

      // Face emotion detection with SSD MobileNet + landmarks
      try {
        const detections = await faceapi
          .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
          .withFaceLandmarks()
          .withFaceExpressions();

        if (detections) {
          faceDetected = true;
          const rawEmotion = getDominantEmotion(detections.expressions);

          // Push to smoother for temporal stability
          smootherRef.current.push(rawEmotion);
          emotionResult = smootherRef.current.get();

          // Draw face box on canvas
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const box = detections.detection.box;
            ctx.strokeStyle = "#06B6D4";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            ctx.setLineDash([]);
          }
        }
      } catch {
        // ignore edge case errors
      }

      // Pose detection
      try {
        if (poseLandmarkerRef.current) {
          const poseResult = poseLandmarkerRef.current.detectForVideo(video, now);
          if (poseResult.landmarks && poseResult.landmarks.length > 0) {
            bodyDetected = true;
            postureResult = classifyPosture(poseResult.landmarks[0]);
          }
        }
      } catch {
        // ignore
      }

      setVisionData({
        emotion: emotionResult.emotion,
        emotionConfidence: emotionResult.confidence,
        allEmotions: emotionResult.all,
        top3: emotionResult.top3 || [],
        posture: postureResult.posture,
        postureSignals: postureResult.signals || [],
        postureDetails: postureResult.details || {},
        faceDetected,
        bodyDetected,
      });

      animFrameRef.current = requestAnimationFrame(analyze);
    }

    animFrameRef.current = requestAnimationFrame(analyze);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [ready, enabled]);

  const getSnapshot = useCallback(() => ({ ...visionData }), [visionData]);

  return {
    videoRef,
    canvasRef,
    ready,
    error,
    visionData,
    getSnapshot,
  };
}
