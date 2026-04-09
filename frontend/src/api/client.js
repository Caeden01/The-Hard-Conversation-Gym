const API_BASE = "/api";

export async function fetchScenarios() {
  const res = await fetch(`${API_BASE}/scenarios`);
  if (!res.ok) throw new Error("Failed to fetch scenarios");
  const data = await res.json();
  return data.scenarios;
}

export async function fetchScenarioDetail(scenarioId) {
  const res = await fetch(`${API_BASE}/scenarios/${scenarioId}`);
  if (!res.ok) throw new Error("Failed to fetch scenario");
  return res.json();
}

export async function startSession(scenarioId) {
  const res = await fetch(`${API_BASE}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario_id: scenarioId }),
  });
  if (!res.ok) throw new Error("Failed to start session");
  return res.json();
}

export async function sendMessage(sessionId, message) {
  const res = await fetch(`${API_BASE}/session/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

export async function sendMessageStream(sessionId, message, onText, onScores) {
  const res = await fetch(`${API_BASE}/session/message/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  if (!res.ok) throw new Error("Failed to send message");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;

      try {
        const parsed = JSON.parse(payload);
        if (parsed.type === "text") {
          onText(parsed.content);
        } else if (parsed.type === "scores") {
          onScores(parsed.data);
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export async function endSession(sessionId) {
  const res = await fetch(`${API_BASE}/session/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error("Failed to end session");
  return res.json();
}

export async function replayBranch(sessionId, nodeId, message) {
  const res = await fetch(`${API_BASE}/session/replay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, node_id: nodeId, message }),
  });
  if (!res.ok) throw new Error("Failed to replay branch");
  return res.json();
}

export async function getSessionTree(sessionId) {
  const res = await fetch(`${API_BASE}/session/${sessionId}/tree`);
  if (!res.ok) throw new Error("Failed to get tree");
  return res.json();
}
