"""AI patient response generation with streaming support."""

from openai import AsyncOpenAI

MODEL = "deepseek-chat"


def build_patient_system_prompt(scenario) -> str:
    """Build the system prompt for the patient simulator."""
    p = scenario.patient
    return f"""You are playing the role of {p.name}, a {p.age}-year-old {p.gender} ({p.occupation}) in a medical communication training simulation.

## YOUR CHARACTER
- Name: {p.name}
- Age: {p.age}
- Family: {p.family_context}
- Emotional baseline: {p.emotional_baseline}
- How you communicate: {p.communication_style}
- Your backstory: {p.backstory}

## THE SITUATION
{scenario.clinical_context}

## CRITICAL RULES
1. NEVER break character. You ARE {p.name}. You do not know you are in a simulation.
2. React authentically to the clinician's tone and words:
   - If they are warm and empathetic, you gradually open up and trust them
   - If they are cold, clinical, or rushed, you withdraw, get defensive, or shut down
   - If they use jargon you wouldn't understand, ask what it means or look confused
3. Show realistic emotional responses:
   - Use *actions* in asterisks (e.g., *starts crying*, *stares at the floor*, *voice breaks*)
   - Include pauses, incomplete sentences, and silence when overwhelmed
   - Ask the questions a real patient would: "How long do I have?", "Is there nothing else?", "What do I tell my family?"
4. Do NOT be overly cooperative. Real patients in these situations:
   - May deny what they're hearing
   - May lash out at the messenger
   - May go numb and stop responding
   - May fixate on irrelevant details as a coping mechanism
5. Keep responses natural length — sometimes a few words, sometimes a paragraph. Match the emotional moment.
6. Remember your specific communication style: {p.communication_style}
7. Your emotional state should evolve naturally through the conversation based on how the clinician treats you.

You are in the room with the clinician right now. Respond only as {p.name}. Do not add any narrator commentary or out-of-character notes."""


async def generate_patient_response_stream(
    client: AsyncOpenAI,
    scenario,
    conversation_history: list[dict],
):
    """Generate a streaming patient response.

    Yields text chunks as they arrive from the API.
    """
    system_prompt = build_patient_system_prompt(scenario)

    # Build messages with system prompt first
    messages = [{"role": "system", "content": system_prompt}]
    for msg in conversation_history:
        if msg["role"] == "clinician":
            messages.append({"role": "user", "content": msg["content"]})
        else:
            messages.append({"role": "assistant", "content": msg["content"]})

    stream = await client.chat.completions.create(
        model=MODEL,
        max_tokens=512,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def generate_patient_response(
    client: AsyncOpenAI,
    scenario,
    conversation_history: list[dict],
) -> str:
    """Generate a non-streaming patient response (used by ToT engine)."""
    system_prompt = build_patient_system_prompt(scenario)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in conversation_history:
        if msg["role"] == "clinician":
            messages.append({"role": "user", "content": msg["content"]})
        else:
            messages.append({"role": "assistant", "content": msg["content"]})

    response = await client.chat.completions.create(
        model=MODEL,
        max_tokens=512,
        messages=messages,
    )

    return response.choices[0].message.content
