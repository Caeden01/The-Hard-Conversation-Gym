"""FastAPI application for The Hard Conversation Gym."""

import os
import uuid
from contextlib import asynccontextmanager

from openai import AsyncOpenAI
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from debrief import generate_debrief
from patient_simulator import build_patient_system_prompt
from scenarios import get_scenario, list_scenarios
from tot_engine import TreeOfThoughts
from voice_analysis import analyze_speech_metadata, aggregate_voice_metrics, generate_voice_debrief

from pathlib import Path
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        print("WARNING: DEEPSEEK_API_KEY not set. API calls will fail.")
    app.state.client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com")
    app.state.sessions = {}
    yield


app = FastAPI(title="The Hard Conversation Gym", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Models ---


class StartSessionRequest(BaseModel):
    scenario_id: str


class SendMessageRequest(BaseModel):
    session_id: str
    message: str


class BranchReplayRequest(BaseModel):
    session_id: str
    node_id: str
    message: str


# --- Session management ---


class Session:
    def __init__(self, session_id: str, scenario, tot: TreeOfThoughts):
        self.id = session_id
        self.scenario = scenario
        self.tot = tot
        self.is_active = True
        self.voice_mode = False
        self.voice_analyses: list[dict] = []


# --- Endpoints ---


@app.get("/api/scenarios")
async def get_scenarios():
    return {"scenarios": list_scenarios()}


@app.get("/api/scenarios/{scenario_id}")
async def get_scenario_detail(scenario_id: str):
    scenario = get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {
        "id": scenario.id,
        "title": scenario.title,
        "description": scenario.description,
        "difficulty": scenario.difficulty,
        "skills_tested": scenario.skills_tested,
        "estimated_minutes": scenario.estimated_minutes,
        "clinician_role": scenario.clinician_role,
        "patient_name": scenario.patient.name,
        "patient_age": scenario.patient.age,
        "opening_line": scenario.opening_line,
        "spikes_notes": scenario.spikes_notes,
    }


@app.post("/api/session/start")
async def start_session(req: StartSessionRequest):
    scenario = get_scenario(req.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    session_id = str(uuid.uuid4())
    tot = TreeOfThoughts(app.state.client, scenario)
    session = Session(session_id, scenario, tot)
    app.state.sessions[session_id] = session

    return {
        "session_id": session_id,
        "scenario_id": scenario.id,
        "scenario_title": scenario.title,
        "clinician_role": scenario.clinician_role,
        "patient_name": scenario.patient.name,
        "opening_line": scenario.opening_line,
    }


@app.post("/api/session/message")
async def send_message(req: SendMessageRequest):
    session = app.state.sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.is_active:
        raise HTTPException(status_code=400, detail="Session has ended")

    import traceback
    try:
        result = await session.tot.process_turn(req.message)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/session/message/stream")
async def send_message_stream(req: SendMessageRequest):
    """Stream the patient response while running ToT scoring in the background.

    Uses SSE to stream text chunks, then sends the scoring data at the end.
    """
    import asyncio
    import json

    session = app.state.sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.is_active:
        raise HTTPException(status_code=400, detail="Session has ended")

    async def event_stream():
        # Run ToT processing (which includes patient response generation)
        result = await session.tot.process_turn(req.message)

        # Stream the patient response word by word for natural feel
        response_text = result["patient_response"]
        words = response_text.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == 0 else " " + word
            yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
            await asyncio.sleep(0.03)  # slight delay for natural feel

        # Send scoring data at the end
        yield f"data: {json.dumps({'type': 'scores', 'data': result})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/session/end")
async def end_session(req: dict):
    session_id = req.get("session_id")
    session = app.state.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_active = False

    # Generate debrief
    tree_data = session.tot.get_tree_data()
    debrief = await generate_debrief(
        app.state.client,
        tree_data,
        session.scenario.clinical_context,
        session.scenario.title,
    )

    return debrief


@app.post("/api/session/replay")
async def branch_replay(req: BranchReplayRequest):
    """Replay from a specific node in the conversation tree."""
    session = app.state.sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get conversation history up to the branch point
    history = session.tot.get_conversation_at_node(req.node_id)

    # Remove the last patient response (we're replaying from here)
    if history and history[-1]["role"] == "patient":
        history.pop()
    # Also remove the last clinician utterance since user is providing a new one
    if history and history[-1]["role"] == "clinician":
        history.pop()

    # Create a temporary ToT for this branch
    replay_tot = TreeOfThoughts(app.state.client, session.scenario)
    replay_tot.conversation_history = history

    result = await replay_tot.process_turn(req.message)
    return result


@app.get("/api/session/{session_id}/tree")
async def get_session_tree(session_id: str):
    session = app.state.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.tot.get_tree_data()


@app.post("/api/session/end/voice")
async def end_session_voice(req: dict):
    """End session with voice-specific debrief including delivery metrics."""
    import json as json_mod

    session_id = req.get("session_id")
    session = app.state.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_active = False

    # Standard debrief
    tree_data = session.tot.get_tree_data()
    debrief = await generate_debrief(
        app.state.client,
        tree_data,
        session.scenario.clinical_context,
        session.scenario.title,
    )

    # Voice metrics
    voice_metrics = aggregate_voice_metrics(session.voice_analyses)

    # Build conversation summary for voice debrief
    conv_summary = "\n".join(
        f"Turn {i+1}: Clinician said \"{n['clinician_utterance']}\" -> Patient: \"{n['patient_response']}\""
        for i, n in enumerate(tree_data.get("selected_path", []))
    )

    voice_debrief = await generate_voice_debrief(
        app.state.client,
        voice_metrics,
        conv_summary,
        session.scenario.title,
    )

    debrief["voice_metrics"] = voice_metrics
    debrief["voice_debrief"] = voice_debrief
    return debrief


@app.websocket("/ws/voice/{session_id}")
async def voice_websocket(websocket: WebSocket, session_id: str):
    """WebSocket for real-time voice conversation.

    Client sends JSON: {
        "type": "utterance",
        "text": "...",
        "speech_duration_ms": 2500,
        "pause_before_ms": 1200,
        "was_interrupted": false
    }

    Server responds with JSON: {
        "type": "response",
        "patient_response": "...",
        "emotional_state": "...",
        "scores": {...},
        "voice_analysis": {...}
    }
    """
    import json as json_mod
    import traceback

    await websocket.accept()

    session = app.state.sessions.get(session_id)
    if not session:
        await websocket.send_json({"type": "error", "detail": "Session not found"})
        await websocket.close()
        return

    session.voice_mode = True

    # Send initial greeting
    await websocket.send_json({
        "type": "ready",
        "patient_name": session.scenario.patient.name,
        "opening_line": session.scenario.opening_line,
        "clinician_role": session.scenario.clinician_role,
    })

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "utterance":
                text = data.get("text", "").strip()
                if not text:
                    continue

                speech_duration = data.get("speech_duration_ms", 0)
                pause_before = data.get("pause_before_ms", 0)
                was_interrupted = data.get("was_interrupted", False)

                # Vision data from webcam (face emotion + posture)
                vision = data.get("vision", {})

                # Analyze voice delivery
                voice_data = analyze_speech_metadata(
                    text, speech_duration, pause_before, was_interrupted
                )
                session.voice_analyses.append(voice_data)

                # Build visual context string for the AI
                visual_context = ""
                if vision:
                    face_emo = vision.get("emotion", "")
                    face_conf = vision.get("emotionConfidence", 0)
                    posture = vision.get("posture", "")
                    signals = vision.get("postureSignals", [])
                    if face_emo and face_conf > 0.3:
                        visual_context += f"The clinician's facial expression appears {face_emo} (confidence: {face_conf:.0%}). "
                    if posture and posture != "unknown":
                        visual_context += f"Their body posture is {posture}. "
                    if signals:
                        visual_context += f"Body language signals: {', '.join(signals)}. "

                # Store vision data on the session for debrief
                if not hasattr(session, "vision_history"):
                    session.vision_history = []
                session.vision_history.append(vision)

                await websocket.send_json({"type": "processing"})

                try:
                    # Pass visual context into the ToT engine
                    result = await session.tot.process_turn(
                        text, visual_context=visual_context
                    )

                    await websocket.send_json({
                        "type": "response",
                        "patient_response": result["patient_response"],
                        "emotional_state": result.get("emotional_state", "engaged"),
                        "scores": {
                            "empathy_score": result.get("empathy_score", 0.5),
                            "spikes_score": result.get("spikes_score", 0.5),
                            "spikes_step": result.get("spikes_step", "none"),
                            "tone": result.get("tone", "neutral"),
                        },
                        "voice_analysis": voice_data,
                        "vision": vision,
                        "turn_number": result.get("turn_number", 0),
                    })
                except Exception as e:
                    traceback.print_exc()
                    await websocket.send_json({
                        "type": "response",
                        "patient_response": "*pauses, seeming to need a moment*",
                        "emotional_state": "withdrawn",
                        "scores": {"empathy_score": 0.5, "spikes_score": 0.5},
                        "voice_analysis": voice_data,
                        "vision": vision,
                        "turn_number": 0,
                    })

            elif data.get("type") == "end":
                break

    except WebSocketDisconnect:
        pass


@app.get("/health")
async def health():
    return {"status": "ok"}
