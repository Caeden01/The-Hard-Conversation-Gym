"""Voice delivery analysis — speech pace, fillers, pauses, interruptions."""

import json
import re
from openai import AsyncOpenAI

MODEL = "deepseek-chat"

FILLER_WORDS = {
    "um", "uh", "er", "ah", "like", "you know", "sort of", "kind of",
    "basically", "actually", "literally", "right", "okay so", "i mean",
}

MEDICAL_JARGON = {
    "prognosis", "metastasis", "metastatic", "palliative", "oncology",
    "chemotherapy", "radiation", "immunotherapy", "biopsy", "malignant",
    "benign", "carcinoma", "adenocarcinoma", "neoplasm", "resection",
    "adjuvant", "remission", "staging", "pathology", "histology",
    "morbidity", "mortality", "etiology", "idiopathic", "contraindicated",
    "prophylactic", "subcutaneous", "intravenous", "hemoglobin", "hematocrit",
    "leukocyte", "platelet", "CBC", "CT", "MRI", "PET", "A1C",
}


def analyze_speech_metadata(
    utterance: str,
    speech_duration_ms: float,
    pause_before_ms: float,
    was_interrupted: bool,
) -> dict:
    """Analyze a single clinician utterance for delivery quality."""
    words = utterance.split()
    word_count = len(words)

    # Words per minute
    if speech_duration_ms > 0:
        wpm = (word_count / speech_duration_ms) * 60000
    else:
        wpm = 0

    # Filler word detection
    lower = utterance.lower()
    fillers_found = []
    for filler in FILLER_WORDS:
        count = lower.count(filler)
        if count > 0:
            fillers_found.extend([filler] * count)

    filler_ratio = len(fillers_found) / max(word_count, 1)

    # Jargon detection
    jargon_found = []
    for word in words:
        clean = re.sub(r'[^a-zA-Z]', '', word).lower()
        if clean in MEDICAL_JARGON or clean.upper() in MEDICAL_JARGON:
            jargon_found.append(word)

    # Pace scoring: 120-150 WPM is ideal for clinical communication
    if 120 <= wpm <= 150:
        pace_score = 1.0
    elif 100 <= wpm < 120 or 150 < wpm <= 170:
        pace_score = 0.7
    elif wpm < 100:
        pace_score = 0.5  # too slow
    else:
        pace_score = 0.4  # too fast (>170)

    # Filler penalty
    filler_score = max(0, 1.0 - (filler_ratio * 5))

    # Pause scoring: appropriate pauses show thoughtfulness
    if 500 <= pause_before_ms <= 3000:
        pause_score = 1.0  # thoughtful pause
    elif pause_before_ms < 500:
        pause_score = 0.6  # rushed
    else:
        pause_score = 0.5  # awkwardly long

    # Interruption penalty
    interruption_penalty = 0.3 if was_interrupted else 0.0

    # Composite delivery score
    delivery_score = max(0, min(1,
        (pace_score * 0.3)
        + (filler_score * 0.25)
        + (pause_score * 0.25)
        + ((1.0 - interruption_penalty) * 0.2)
    ))

    return {
        "word_count": word_count,
        "speech_duration_ms": speech_duration_ms,
        "wpm": round(wpm, 1),
        "pace_rating": "ideal" if pace_score >= 0.9 else "too_fast" if wpm > 150 else "too_slow",
        "pace_score": round(pace_score, 2),
        "fillers_found": fillers_found,
        "filler_count": len(fillers_found),
        "filler_ratio": round(filler_ratio, 3),
        "filler_score": round(filler_score, 2),
        "jargon_found": jargon_found,
        "jargon_count": len(jargon_found),
        "pause_before_ms": pause_before_ms,
        "pause_score": round(pause_score, 2),
        "was_interrupted": was_interrupted,
        "delivery_score": round(delivery_score, 3),
    }


def aggregate_voice_metrics(turn_analyses: list[dict]) -> dict:
    """Aggregate voice metrics across all turns for the debrief."""
    if not turn_analyses:
        return {}

    n = len(turn_analyses)
    total_fillers = sum(t["filler_count"] for t in turn_analyses)
    total_jargon = sum(t["jargon_count"] for t in turn_analyses)
    total_interruptions = sum(1 for t in turn_analyses if t["was_interrupted"])
    avg_wpm = sum(t["wpm"] for t in turn_analyses) / n
    avg_delivery = sum(t["delivery_score"] for t in turn_analyses) / n
    avg_pause = sum(t["pause_before_ms"] for t in turn_analyses) / n

    # Find all unique fillers
    all_fillers = []
    for t in turn_analyses:
        all_fillers.extend(t["fillers_found"])

    all_jargon = []
    for t in turn_analyses:
        all_jargon.extend(t["jargon_found"])

    return {
        "total_turns": n,
        "avg_wpm": round(avg_wpm, 1),
        "avg_delivery_score": round(avg_delivery, 3),
        "total_fillers": total_fillers,
        "unique_fillers": list(set(all_fillers)),
        "total_jargon": total_jargon,
        "unique_jargon": list(set(all_jargon)),
        "total_interruptions": total_interruptions,
        "avg_pause_ms": round(avg_pause, 0),
        "per_turn": turn_analyses,
    }


async def generate_voice_debrief(
    client: AsyncOpenAI,
    voice_metrics: dict,
    conversation_summary: str,
    scenario_title: str,
) -> dict:
    """Generate AI-powered voice-specific debrief using delivery data."""

    prompt = f"""You are a clinical communication coach analyzing a doctor's VERBAL delivery during a difficult conversation practice session.

## Scenario: {scenario_title}

## Voice Delivery Metrics
- Average speaking pace: {voice_metrics.get('avg_wpm', 0)} words per minute (ideal: 120-150 WPM)
- Average delivery score: {voice_metrics.get('avg_delivery_score', 0):.0%}
- Total filler words used: {voice_metrics.get('total_fillers', 0)} ({', '.join(voice_metrics.get('unique_fillers', [])) or 'none'})
- Medical jargon used: {voice_metrics.get('total_jargon', 0)} instances ({', '.join(voice_metrics.get('unique_jargon', [])) or 'none'})
- Interruptions: {voice_metrics.get('total_interruptions', 0)}
- Average pause before responding: {voice_metrics.get('avg_pause_ms', 0):.0f}ms

## Per-Turn Delivery Data
{json.dumps(voice_metrics.get('per_turn', []), indent=2)}

## Conversation Context
{conversation_summary}

Generate a voice delivery evaluation as JSON with:
- communication_score: integer 0-100 overall score
- pace_assessment: 1-2 sentence assessment of speaking pace
- filler_assessment: assessment of filler word usage with specific examples
- jargon_assessment: whether medical terminology was used appropriately or should have been simplified
- pause_assessment: whether pauses were used effectively (showing thoughtfulness) or awkwardly
- interruption_assessment: assessment of any interruptions
- strong_moments: array of 2-3 objects with "moment" and "why_effective"
- missed_opportunities: array of 2-3 objects with "moment" and "suggestion"
- delivery_tips: array of 3 specific, actionable tips for improving verbal delivery
- overall_tone: one of "empathetic", "clinical", "warm", "cold", "nervous", "confident", "rushed"

Return ONLY valid JSON."""

    response = await client.chat.completions.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.choices[0].message.content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "communication_score": 50,
            "pace_assessment": "Unable to analyze.",
            "delivery_tips": [],
        }
