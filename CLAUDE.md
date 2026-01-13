# CLAUDE.md

This file provides context to Claude when working on this codebase.

## Project Overview

**My AI Office** is a personal AI agent system with a web-based office interface. It's designed to help the user with productivity, development, research, communication, and workflow automation through specialized AI agents.

## Architecture

### Agents (`src/agents/`)

Each agent extends `BaseAgent` and has:
- A system prompt defining its personality and capabilities
- Tools (functions it can call)
- Access to shared memory/preferences

| Agent | File | Purpose |
|-------|------|---------|
| Orchestrator | `orchestrator.ts` | Central coordinator, routes tasks, learns preferences |
| Dev | `dev-agent.ts` | Coding tasks, shell commands, file operations |
| Research | `research-agent.ts` | Web fetching, knowledge storage |
| Comms | `comms-agent.ts` | Document templates, drafting |
| Workflow | `workflow-agent.ts` | Task management, workflows |

### Memory System (`src/memory/database.ts`)

SQLite database storing:
- **memories**: Facts, preferences, conversation snippets
- **tasks**: User tasks with status and assignment
- **preferences**: Learned user preferences by category
- **conversations**: Chat history per session

### Web Interface (`src/web/`)

- `server.ts`: Express API with endpoints for chat, tasks, launch manager
- `public/index.html`: Single-page app with office UI

### Launch Manager

Built into the web UI for MVP tracking:
- **Projects**: Name, URL, description
- **Milestones**: Launch goals with status
- **Outreach**: Contact pipeline (kanban-style)
- **Learnings**: Categorized insights
- **Metrics**: Key numbers to track

## Key Files

- `src/core/base-agent.ts` - The foundation all agents build on
- `src/web/server.ts` - API routes and database initialization
- `src/web/public/index.html` - Complete frontend (HTML/CSS/JS)
- `src/types/index.ts` - TypeScript interfaces

## Development Commands

```bash
npm run web          # Start web server on port 3847
npm run office       # Terminal UI (requires interactive terminal)
npm run build        # Compile TypeScript
npx tsc --noEmit     # Type check without building
```

## Database Location

SQLite databases are created in `data/`:
- `team.db` - Agent memory, tasks, preferences
- `launch.db` - Launch manager data

## API Endpoints

### Agents
- `GET /api/agents` - List all agents
- `POST /api/chat` - Send message to agent `{ message, agent }`
- `GET /api/tasks` - Get all tasks
- `GET /api/preferences` - Get learned preferences

### Launch Manager
- `GET /api/launch/summary` - Full dashboard data
- `GET/POST /api/launch/milestones` - Milestone CRUD
- `GET/POST/PUT/DELETE /api/launch/outreach` - Contact CRUD
- `GET/POST /api/launch/learnings` - Learnings CRUD
- `GET/POST /api/launch/metrics` - Metrics CRUD

## Current State

The project is functional with:
- 5 working agents that can chat via Claude API
- Web UI with office theme (light/dark mode)
- Launch manager for MVP tracking
- SQLite persistence

## User Context

The user is launching **LoanFlow** (loanflow.pages.dev), a CRM for mortgage professionals. The launch manager is pre-configured for this project. Key learnings so far:
- LinkedIn cold outreach doesn't work well
- Facebook groups are better for reaching mortgage pros

## Code Style

- TypeScript with strict mode
- ES modules (`"type": "module"`)
- Functional approach where possible
- Single-file frontend (no build step for UI)
