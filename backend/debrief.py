"""Debrief report generation using the Tree of Thoughts data."""

import json
from openai import AsyncOpenAI

MODEL = "deepseek-chat"


async def generate_debrief(
    client: AsyncOpenAI,
    tree_data: dict,
    scenario_context: str,
    scenario_title: str,
) -> dict:
    """Generate a comprehensive debrief report from the conversation tree."""

    selected_path = tree_data["selected_path"]
    turning_points = tree_data["turning_points"]

    # Calculate overall scores
    if selected_path:
        avg_empathy = sum(n["empathy_score"] for n in selected_path) / len(selected_path)
        avg_spikes = sum(n["spikes_score"] for n in selected_path) / len(selected_path)
    else:
        avg_empathy = 0.0
        avg_spikes = 0.0

    # Build the conversation summary for the AI debrief
    turn_summaries = []
    for i, node in enumerate(selected_path):
        turn_summaries.append(
            f"Turn {i + 1}:\n"
            f"  Clinician: \"{node['clinician_utterance']}\"\n"
            f"  Patient: \"{node['patient_response']}\"\n"
            f"  Empathy: {node['empathy_score']:.2f} | SPIKES: {node['spikes_score']:.2f}\n"
            f"  Tone: {node.get('score_details', {}).get('tone', 'N/A')}\n"
            f"  Red flags: {node.get('score_details', {}).get('red_flags', [])}\n"
            f"  Strengths: {node.get('score_details', {}).get('strengths', [])}"
        )

    prompt = f"""You are a clinical communication expert reviewing a training conversation where a clinician practiced delivering difficult news.

## Scenario
{scenario_title}: {scenario_context}

## Conversation (with scores)
{chr(10).join(turn_summaries)}

## Overall Scores
Average Empathy: {avg_empathy:.2f}/1.0
Average SPIKES Adherence: {avg_spikes:.2f}/1.0
Total Turns: {len(selected_path)}

## Turning Points Detected
{json.dumps(turning_points, indent=2)}

Generate a comprehensive debrief report as JSON with these fields:
- overall_assessment: A 2-3 sentence overall assessment of the conversation
- empathy_rating: "excellent" / "good" / "needs_improvement" / "poor"
- spikes_rating: "excellent" / "good" / "needs_improvement" / "poor"
- done_well: array of exactly 3 objects, each with "point" (the thing done well) and "example" (quote from the conversation demonstrating it)
- to_improve: array of exactly 3 objects, each with "point" (what to improve), "example" (what was said), and "better_alternative" (example of what to say instead)
- spikes_breakdown: object with keys S, P, I, K, E, S2 (second S for Strategy), each with "addressed" (boolean), "score" (0-1), and "note" (brief assessment)
- critical_moment: object with "turn" (number), "description" (what happened), and "impact" (how it affected the conversation)
- emotional_arc: brief description of how the patient's emotional state evolved through the conversation

Return ONLY valid JSON."""

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
        ai_debrief = json.loads(text)
    except json.JSONDecodeError:
        ai_debrief = {
            "overall_assessment": "Unable to generate detailed assessment.",
            "empathy_rating": "needs_improvement",
            "spikes_rating": "needs_improvement",
            "done_well": [],
            "to_improve": [],
            "spikes_breakdown": {},
            "critical_moment": None,
            "emotional_arc": "Unable to analyze.",
        }

    return {
        "scenario_title": scenario_title,
        "overall_empathy_score": round(avg_empathy, 3),
        "overall_spikes_score": round(avg_spikes, 3),
        "total_turns": len(selected_path),
        "timeline": [
            {
                "turn": i + 1,
                "clinician": node["clinician_utterance"],
                "patient": node["patient_response"],
                "empathy_score": node["empathy_score"],
                "spikes_score": node["spikes_score"],
                "spikes_step": node.get("score_details", {}).get("spikes_step_addressed", "N/A"),
                "tone": node.get("score_details", {}).get("tone", "N/A"),
                "red_flags": node.get("score_details", {}).get("red_flags", []),
                "strengths": node.get("score_details", {}).get("strengths", []),
                "suggested_alternative": node.get("suggested_alternative"),
                "emotional_state": node.get("emotional_state", "N/A"),
                "node_id": node["id"],
            }
            for i, node in enumerate(selected_path)
        ],
        "turning_points": turning_points,
        "ai_debrief": ai_debrief,
    }
