# My AI Office

A personal AI agent team with a visual office interface. Built with Claude, TypeScript, and SQLite.

![Dark Mode](https://img.shields.io/badge/theme-dark%20%2F%20light-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![Claude](https://img.shields.io/badge/Claude-Sonnet-orange)

## What is this?

Your own AI office with 5 specialized agents ready to help:

| Agent | Role | What they do |
|-------|------|--------------|
| **Orchestrator** | Team Coordinator | Routes tasks, learns your preferences |
| **Dev** | Software Engineer | Coding, debugging, architecture |
| **Research** | Research Analyst | Web research, summaries, analysis |
| **Comms** | Communications Lead | Emails, docs, reports |
| **Workflow** | Operations Manager | Tasks, automation, workflows |

Plus a **Launch Manager** to track your MVP launch with:
- Kanban pipeline for outreach
- Milestone tracking with progress bar
- Learnings board
- Key metrics

## Quick Start

```bash
# Clone
git clone https://github.com/yaneyba/my-ai-office.git
cd my-ai-office

# Install
npm install

# Set your API key
echo "ANTHROPIC_API_KEY=your-key-here" > .env

# Run
npm run web
```

Open **http://localhost:3847**

## Features

### Office View
- Click any agent's desk to chat directly with them
- Meeting room shows your key stats at a glance
- Bulletin board displays recent learnings
- Light/dark theme toggle

### Launch Room
- **Pipeline**: Track contacts through stages (To Contact → Contacted → Responded → Won)
- **Milestones**: Click to cycle through pending → in progress → completed
- **Learnings**: Categorize what's working and what's not

## Scripts

```bash
npm run web          # Start web interface (recommended)
npm run office       # Terminal-based office UI
npm run launch       # Terminal-based launch manager
npm run orchestrator # Chat with Orchestrator directly
npm run dev-agent    # Chat with Dev agent directly
```

## Project Structure

```
my-ai-office/
├── src/
│   ├── agents/           # Individual agent implementations
│   │   ├── orchestrator.ts
│   │   ├── dev-agent.ts
│   │   ├── research-agent.ts
│   │   ├── comms-agent.ts
│   │   └── workflow-agent.ts
│   ├── core/
│   │   └── base-agent.ts # Shared agent framework
│   ├── memory/
│   │   └── database.ts   # SQLite persistence
│   ├── web/
│   │   ├── server.ts     # Express API server
│   │   └── public/       # Frontend assets
│   └── types/
│       └── index.ts      # TypeScript types
├── data/                 # SQLite databases (gitignored)
└── package.json
```

## How it works

1. **Agents** extend a `BaseAgent` class that handles Claude API calls, conversation history, and tool execution
2. **Memory** is persisted to SQLite - preferences, learnings, tasks, and conversations survive restarts
3. **Web UI** is a single-page app that talks to an Express backend
4. **Tools** give agents capabilities like running shell commands, reading files, and saving memories

## Tech Stack

- **Claude API** via `@anthropic-ai/sdk`
- **Express** for the web server
- **SQLite** via `better-sqlite3` for persistence
- **TypeScript** for type safety
- **tsx** for running TypeScript directly

## License

MIT
