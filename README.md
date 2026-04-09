# The Hard Conversation Gym

AI-powered clinical communication trainer that helps medical students, nurses, residents, and social workers practice delivering difficult news using a Tree of Thoughts (ToT) architecture.

## How It Works

1. **Choose a scenario** - Select from 6 clinical situations (terminal diagnosis, death notification, treatment failure, etc.)
2. **Practice the conversation** - Chat with an AI patient who reacts authentically to your communication style
3. **Review your debrief** - Get scored on the SPIKES framework and empathy, with specific feedback and the ability to replay from any turning point

### Tree of Thoughts Engine

Behind every conversation turn, the ToT engine:
- Generates 3 branching patient responses (defensive, grieving, questioning)
- Scores your utterance against the SPIKES protocol
- Selects the most realistic branch based on your empathy level
- Tracks turning points where the conversation shifted positively or negatively
- Builds a full conversation tree for debrief analysis

### SPIKES Framework

Each utterance is scored against the 6-step SPIKES protocol for breaking bad news:
- **S**etting - establishing privacy and comfort
- **P**erception - assessing what the patient knows
- **I**nvitation - asking how much info they want
- **K**nowledge - delivering news with a warning shot
- **E**motions - acknowledging feelings, allowing silence
- **S**trategy - discussing next steps

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- DeepSeek API key

### Setup

```bash
# Clone and set up API key
cp .env.example .env
# Edit .env and add your DEEPSEEK_API_KEY

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Python FastAPI
- **AI**: DeepSeek API (deepseek-chat)
- **Architecture**: Tree of Thoughts with DFS + backtracking

## Scenarios

| Scenario | Difficulty | Description |
|----------|-----------|-------------|
| Stage 4 Pancreatic Cancer | Advanced | Tell a 45-year-old teacher her biopsy confirmed terminal cancer |
| Post-Surgical Death | Expert | Notify a family their mother didn't survive surgery |
| Treatment Failure | Intermediate | Tell a 28-year-old his immunotherapy stopped working |
| Child Chronic Condition | Intermediate | Tell parents their 7-year-old has Type 1 diabetes |
| Goals of Care | Advanced | Discuss stopping treatment with a stubborn 81-year-old veteran |
| Adolescent Self-Harm | Advanced | Tell a parent about their teenager's self-harm |
