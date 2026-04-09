"""Tree of Thoughts engine with DFS + backtracking for conversation evaluation."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from openai import AsyncOpenAI

from scoring import score_utterance, generate_branch_responses


@dataclass
class ConversationNode:
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    depth: int = 0
    clinician_utterance: str = ""
    patient_response: str = ""
    empathy_score: float = 0.0
    spikes_score: float = 0.0
    is_open: bool = True
    conclusions: list[str] = field(default_factory=list)
    children: list[ConversationNode] = field(default_factory=list)
    branch_label: str = ""
    branch_type: str = ""  # "defensive", "grieving", "questioning", "selected"
    emotional_state: str = "calm"
    score_details: dict = field(default_factory=dict)
    suggested_alternative: str | None = None
    is_selected_path: bool = False  # the branch actually shown to the user


class TreeOfThoughts:
    """Manages the conversation tree, scoring, and branch evaluation."""

    def __init__(self, client: AsyncOpenAI, scenario):
        self.client = client
        self.scenario = scenario
        self.root: ConversationNode | None = None
        self.current_node: ConversationNode | None = None
        self.selected_path: list[ConversationNode] = []
        self.all_nodes: dict[str, ConversationNode] = {}
        self.conversation_history: list[dict] = []
        self.score_threshold = 0.4  # below this triggers backtrack flagging
        self.turning_points: list[dict] = []

    def _get_patient_profile(self) -> dict:
        p = self.scenario.patient
        return {
            "name": p.name,
            "age": p.age,
            "emotional_baseline": p.emotional_baseline,
            "communication_style": p.communication_style,
            "backstory": p.backstory,
        }

    async def process_turn(self, clinician_utterance: str) -> dict:
        """Process a clinician utterance: score it, generate branches, select best path.

        Returns the selected patient response and live scoring data.
        """
        # 1. Score the clinician's utterance
        score_data = await score_utterance(
            self.client,
            self.conversation_history,
            clinician_utterance,
            self.scenario.clinical_context,
            self.scenario.spikes_notes,
        )

        # 2. Generate 3 branching patient responses
        branches = await generate_branch_responses(
            self.client,
            self.conversation_history,
            clinician_utterance,
            self._get_patient_profile(),
            self.scenario.clinical_context,
        )

        # 3. Select the most realistic branch for the live conversation
        selected = self._select_best_branch(branches, score_data)

        # 4. Create the conversation node
        node = ConversationNode(
            depth=len(self.selected_path),
            clinician_utterance=clinician_utterance,
            patient_response=selected["response_text"],
            empathy_score=score_data.get("empathy_score", 0.5),
            spikes_score=score_data.get("spikes_score", 0.5),
            branch_label=score_data.get("branch_label", ""),
            branch_type="selected",
            emotional_state=selected.get("emotional_state", "engaged"),
            score_details=score_data,
            suggested_alternative=score_data.get("suggested_alternative"),
            is_selected_path=True,
        )
        self.all_nodes[node.id] = node

        # 5. Create child nodes for alternative branches
        for branch in branches:
            child = ConversationNode(
                depth=node.depth,
                clinician_utterance=clinician_utterance,
                patient_response=branch.get("response_text", ""),
                empathy_score=score_data.get("empathy_score", 0.5),
                spikes_score=score_data.get("spikes_score", 0.5),
                branch_label=branch.get("branch_type", ""),
                branch_type=branch.get("branch_type", ""),
                emotional_state=branch.get("emotional_state", "engaged"),
                is_selected_path=False,
            )
            node.children.append(child)
            self.all_nodes[child.id] = child

        # 6. Link to tree
        if self.current_node:
            self.current_node.children.append(node)
        else:
            self.root = node

        self.current_node = node
        self.selected_path.append(node)

        # 7. Update conversation history
        self.conversation_history.append(
            {"role": "clinician", "content": clinician_utterance}
        )
        self.conversation_history.append(
            {"role": "patient", "content": selected["response_text"]}
        )

        # 8. Detect turning points
        avg_score = (node.empathy_score + node.spikes_score) / 2
        if avg_score < self.score_threshold:
            self.turning_points.append(
                {
                    "turn": len(self.selected_path),
                    "node_id": node.id,
                    "type": "negative",
                    "score": avg_score,
                    "reason": score_data.get("red_flags", []),
                    "suggested_alternative": score_data.get("suggested_alternative"),
                }
            )
        elif avg_score > 0.8 and len(self.selected_path) > 1:
            prev = self.selected_path[-2]
            prev_avg = (prev.empathy_score + prev.spikes_score) / 2
            if prev_avg < 0.6:
                self.turning_points.append(
                    {
                        "turn": len(self.selected_path),
                        "node_id": node.id,
                        "type": "positive",
                        "score": avg_score,
                        "reason": score_data.get("strengths", []),
                    }
                )

        return {
            "patient_response": selected["response_text"],
            "emotional_state": selected.get("emotional_state", "engaged"),
            "empathy_score": score_data.get("empathy_score", 0.5),
            "spikes_score": score_data.get("spikes_score", 0.5),
            "spikes_step": score_data.get("spikes_step_addressed", "none"),
            "tone": score_data.get("tone", "neutral"),
            "turn_number": len(self.selected_path),
            "node_id": node.id,
        }

    def _select_best_branch(self, branches: list[dict], score_data: dict) -> dict:
        """Select the most realistic branch based on context.

        Logic:
        - If empathy is high (>0.7), lean toward grieving or questioning (patient opens up)
        - If empathy is low (<0.4), lean toward defensive (patient shuts down)
        - Otherwise, pick highest realism_score
        """
        if not branches:
            return {
                "response_text": "*pauses, processing what was said*",
                "emotional_state": "withdrawn",
                "branch_type": "grieving",
            }

        empathy = score_data.get("empathy_score", 0.5)

        # Bias selection based on clinician empathy
        type_weights = {"defensive": 1.0, "grieving": 1.0, "questioning": 1.0}
        if empathy > 0.7:
            type_weights["grieving"] = 1.5
            type_weights["questioning"] = 1.3
            type_weights["defensive"] = 0.5
        elif empathy < 0.4:
            type_weights["defensive"] = 1.8
            type_weights["grieving"] = 0.8
            type_weights["questioning"] = 0.7

        best = None
        best_score = -1

        for branch in branches:
            realism = branch.get("realism_score", 0.5)
            btype = branch.get("branch_type", "questioning")
            weight = type_weights.get(btype, 1.0)
            weighted_score = realism * weight
            if weighted_score > best_score:
                best_score = weighted_score
                best = branch

        return best or branches[0]

    def get_tree_data(self) -> dict:
        """Export the full tree for debrief visualization."""

        def serialize_node(node: ConversationNode) -> dict:
            return {
                "id": node.id,
                "depth": node.depth,
                "clinician_utterance": node.clinician_utterance,
                "patient_response": node.patient_response,
                "empathy_score": node.empathy_score,
                "spikes_score": node.spikes_score,
                "branch_label": node.branch_label,
                "branch_type": node.branch_type,
                "emotional_state": node.emotional_state,
                "suggested_alternative": node.suggested_alternative,
                "is_selected_path": node.is_selected_path,
                "score_details": node.score_details,
                "children": [serialize_node(c) for c in node.children],
            }

        return {
            "root": serialize_node(self.root) if self.root else None,
            "selected_path": [
                {
                    "id": n.id,
                    "turn": i + 1,
                    "clinician_utterance": n.clinician_utterance,
                    "patient_response": n.patient_response,
                    "empathy_score": n.empathy_score,
                    "spikes_score": n.spikes_score,
                    "branch_label": n.branch_label,
                    "emotional_state": n.emotional_state,
                    "suggested_alternative": n.suggested_alternative,
                    "score_details": n.score_details,
                }
                for i, n in enumerate(self.selected_path)
            ],
            "turning_points": self.turning_points,
            "total_turns": len(self.selected_path),
        }

    def get_conversation_at_node(self, node_id: str) -> list[dict]:
        """Get conversation history up to a specific node (for branch replay)."""
        history = []
        for node in self.selected_path:
            history.append({"role": "clinician", "content": node.clinician_utterance})
            history.append({"role": "patient", "content": node.patient_response})
            if node.id == node_id:
                break
        return history
