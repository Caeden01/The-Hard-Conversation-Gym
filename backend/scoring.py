"""SPIKES framework + empathy scoring via DeepSeek API."""

import json
from openai import AsyncOpenAI

MODEL = "deepseek-chat"

SPIKES_DEFINITION = """The SPIKES protocol is a six-step framework for delivering bad news:

S - SETTING: Establishing the right physical environment (privacy, comfort, minimizing interruptions, having tissues available, ensuring adequate time, sitting down at eye level, inviting relevant support persons).

P - PERCEPTION: Assessing what the patient/family already knows or suspects about their condition. Using open-ended questions like "What have you been told so far?" or "What's your understanding of why we did the test?"

I - INVITATION: Asking the patient how much information they want to receive right now. Some patients want full details, others want the big picture only. Respecting their readiness.

K - KNOWLEDGE: Delivering the medical information clearly. Using a "warning shot" first (e.g., "I'm afraid I have some difficult news"). Avoiding jargon. Speaking in short, clear sentences. Pausing after key information.

E - EMOTIONS/EMPATHY: Responding to the patient's emotional reaction with empathy. Naming emotions ("I can see this is devastating"). Allowing silence. Not rushing to fix or reassure. Validating their feelings. Sitting with the distress.

S - STRATEGY/SUMMARY: Discussing next steps and a plan. Checking understanding. Offering to involve other support (social work, chaplain, family). Summarizing what was discussed. Scheduling follow-up. Leaving the door open for more questions."""


async def score_utterance(
    client: AsyncOpenAI,
    conversation_history: list[dict],
    clinician_utterance: str,
    scenario_context: str,
    spikes_notes: dict[str, str],
    visual_context: str = "",
) -> dict:
    """Score a single clinician utterance against SPIKES + empathy."""

    history_text = "\n".join(
        f"{'Clinician' if m['role'] == 'clinician' else 'Patient'}: {m['content']}"
        for m in conversation_history
    )

    visual_block = ""
    if visual_context:
        visual_block = f"""
## Clinician's Visual Cues (from webcam)
{visual_context}
Note: Use this body language data to assess whether the clinician's non-verbal communication matches their words. A clinician who says empathetic words but appears nervous, avoids eye contact, or has crossed arms may score lower on empathy delivery. Conversely, warm facial expressions and open posture can enhance an otherwise adequate verbal response.
"""

    prompt = f"""You are an expert clinical communication evaluator. Score the clinician's most recent utterance in a difficult conversation.

## SPIKES Framework
{SPIKES_DEFINITION}

## Scenario-Specific SPIKES Notes
{json.dumps(spikes_notes, indent=2)}

## Conversation So Far
{history_text}

## Clinician's Latest Utterance
"{clinician_utterance}"
{visual_block}
## Clinical Context
{scenario_context}

Evaluate this utterance and return a JSON object with these fields:
- empathy_score: float 0.0-1.0 (how empathetically the clinician communicated)
- spikes_score: float 0.0-1.0 (how well this utterance adheres to the appropriate SPIKES step for this point in the conversation)
- spikes_step_addressed: which SPIKES step(s) this utterance primarily addresses (S/P/I/K/E/S or "none")
- tone: one word describing the tone (e.g., "warm", "clinical", "rushed", "empathetic", "cold", "mechanical")
- red_flags: list of strings noting any communication errors (e.g., "used medical jargon without explanation", "didn't allow pause after bad news", "gave false hope")
- strengths: list of strings noting what was done well (e.g., "used warning shot", "acknowledged emotion", "checked understanding")
- suggested_alternative: a better version of the utterance if the score is below 0.7, or null if the utterance was good
- patient_emotional_shift: how this utterance would affect the patient's emotional state ("calming", "neutral", "distressing", "escalating")
- branch_label: brief label for the communication choice made (e.g., "delivered news directly", "asked about understanding first", "used medical jargon")

Return ONLY valid JSON, no other text."""

    response = await client.chat.completions.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.choices[0].message.content.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "empathy_score": 0.5,
            "spikes_score": 0.5,
            "spikes_step_addressed": "none",
            "tone": "unclear",
            "red_flags": [],
            "strengths": [],
            "suggested_alternative": None,
            "patient_emotional_shift": "neutral",
            "branch_label": "unclear",
        }


async def generate_branch_responses(
    client: AsyncOpenAI,
    conversation_history: list[dict],
    clinician_utterance: str,
    patient_profile: dict,
    scenario_context: str,
    visual_context: str = "",
) -> list[dict]:
    """Generate 3 branching patient responses for ToT evaluation."""

    history_text = "\n".join(
        f"{'Clinician' if m['role'] == 'clinician' else 'Patient'}: {m['content']}"
        for m in conversation_history
    )

    visual_block = ""
    if visual_context:
        visual_block = f"""
## Clinician's Body Language (observed by patient)
{visual_context}
The patient can see the clinician's facial expression and body language. A patient picks up on non-verbal cues — if the doctor looks uncomfortable, avoids eye contact, has crossed arms, or appears rushed, the patient notices and reacts accordingly. If the doctor appears warm, maintains eye contact, and has open posture, the patient feels safer.
"""

    prompt = f"""You are simulating realistic patient responses for a medical communication training system.

## Patient Profile
Name: {patient_profile['name']}
Age: {patient_profile['age']}
Emotional baseline: {patient_profile['emotional_baseline']}
Communication style: {patient_profile['communication_style']}
Backstory: {patient_profile['backstory']}

## Clinical Context
{scenario_context}

## Conversation So Far
{history_text}

## Clinician's Latest Utterance
"{clinician_utterance}"
{visual_block}
Generate exactly 3 different realistic patient responses, each representing a different emotional branch:

1. DEFENSIVE: The patient reacts with defensiveness, denial, anger, or resistance
2. GRIEVING: The patient reacts with sadness, tears, withdrawal, or overwhelm
3. QUESTIONING: The patient reacts by seeking more information, asking practical questions, or trying to intellectualize

For each response, provide:
- response_text: what the patient says (include actions in *asterisks* like *starts crying* or *looks away*)
- emotional_state: one of "calm", "distressed", "withdrawn", "engaged", "angry", "shocked", "numb"
- realism_score: float 0.0-1.0 how realistic this response is given the conversation so far
- branch_type: "defensive", "grieving", or "questioning"

Return ONLY a JSON array of 3 objects, no other text."""

    response = await client.chat.completions.create(
        model=MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.choices[0].message.content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[: text.rfind("```")]
        text = text.strip()

    try:
        branches = json.loads(text)
        return branches if isinstance(branches, list) else []
    except json.JSONDecodeError:
        return []
