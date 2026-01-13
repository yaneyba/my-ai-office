import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import { OrchestratorAgent } from '../agents/orchestrator.js';
import { DevAgent } from '../agents/dev-agent.js';
import { ResearchAgent } from '../agents/research-agent.js';
import { CommsAgent } from '../agents/comms-agent.js';
import { WorkflowAgent } from '../agents/workflow-agent.js';
import { getTasks, getMemories, getAllPreferences } from '../memory/database.js';
import type { AgentRole } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3847;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Launch Manager Database
const LAUNCH_DB_PATH = join(__dirname, '../../data/launch.db');
let launchDb: Database.Database | null = null;

function getLaunchDb(): Database.Database {
  if (!launchDb) {
    launchDb = new Database(LAUNCH_DB_PATH);
    initLaunchSchema();
  }
  return launchDb;
}

function initLaunchSchema(): void {
  launchDb!.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT,
      description TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS outreach (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      channel TEXT NOT NULL,
      contact_info TEXT,
      status TEXT DEFAULT 'not_contacted',
      notes TEXT,
      last_contact TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS learnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      value INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);
}

// Agent instances
const agents: Record<string, { agent: any; name: string; icon: string; description: string }> = {};
const sessionId = `web-${Date.now()}`;

function getAgent(role: AgentRole) {
  if (!agents[role]) {
    const AgentClass = {
      orchestrator: OrchestratorAgent,
      dev: DevAgent,
      research: ResearchAgent,
      comms: CommsAgent,
      workflow: WorkflowAgent
    }[role];

    const info = {
      orchestrator: { name: 'Orchestrator', icon: '🎯', description: 'Central coordinator' },
      dev: { name: 'Dev', icon: '💻', description: 'Development partner' },
      research: { name: 'Research', icon: '🔍', description: 'Knowledge gatherer' },
      comms: { name: 'Comms', icon: '✉️', description: 'Communication expert' },
      workflow: { name: 'Workflow', icon: '⚡', description: 'Automation specialist' }
    }[role];

    agents[role] = {
      agent: new AgentClass(sessionId),
      ...info
    };
  }
  return agents[role];
}

// ===================
// OFFICE API ROUTES
// ===================

// Get all agents status
app.get('/api/agents', (req, res) => {
  const agentList = ['orchestrator', 'dev', 'research', 'comms', 'workflow'].map(role => {
    const info = {
      orchestrator: { name: 'Orchestrator', icon: '🎯', description: 'Routes tasks, learns preferences' },
      dev: { name: 'Dev', icon: '💻', description: 'Code, debug, architecture' },
      research: { name: 'Research', icon: '🔍', description: 'Find and synthesize information' },
      comms: { name: 'Comms', icon: '✉️', description: 'Emails, docs, reports' },
      workflow: { name: 'Workflow', icon: '⚡', description: 'Tasks, automation' }
    }[role];
    return { role, ...info, status: 'ready' };
  });
  res.json(agentList);
});

// Chat with an agent
app.post('/api/chat', async (req, res) => {
  const { message, agent: agentRole = 'orchestrator' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const { agent } = getAgent(agentRole as AgentRole);
    const response = await agent.chat(message);
    res.json({
      content: response.content,
      agent: agentRole,
      delegateTo: response.delegateTo
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Get tasks
app.get('/api/tasks', (req, res) => {
  try {
    const tasks = getTasks();
    res.json(tasks);
  } catch (error) {
    res.json([]);
  }
});

// Get preferences
app.get('/api/preferences', (req, res) => {
  try {
    const prefs = getAllPreferences();
    res.json(prefs);
  } catch (error) {
    res.json([]);
  }
});

// Get memories
app.get('/api/memories', (req, res) => {
  try {
    const memories = getMemories(undefined, undefined, 50);
    res.json(memories);
  } catch (error) {
    res.json([]);
  }
});

// ===================
// LAUNCH MANAGER API
// ===================

// Get or create project
app.get('/api/launch/project', (req, res) => {
  const db = getLaunchDb();
  let project = db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT 1').get();

  if (!project) {
    const id = `proj_${Date.now()}`;
    db.prepare(`
      INSERT INTO projects (id, name, url, description, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, 'LoanFlow', 'https://loanflow.pages.dev', 'Simple CRM for mortgage professionals', new Date().toISOString());

    // Add default milestones
    const milestones = [
      'Get first 5 beta users',
      'Collect feedback from beta users',
      'Get first paying customer',
      'Reach 10 paying customers',
      'Hit $500 MRR'
    ];
    for (const title of milestones) {
      db.prepare('INSERT INTO milestones (project_id, title) VALUES (?, ?)').run(id, title);
    }

    // Add initial learnings
    db.prepare(`
      INSERT INTO learnings (project_id, category, content, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, 'Channel Performance', 'LinkedIn cold outreach not working - people ignore DMs', 'Experience', new Date().toISOString());

    db.prepare(`
      INSERT INTO learnings (project_id, category, content, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, 'Market Insight', 'Facebook Groups are active for mortgage pros: Loan Officer Freedom, Mortgage Marketing Animals', 'Research', new Date().toISOString());

    project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  }

  res.json(project);
});

// Update project
app.put('/api/launch/project', (req, res) => {
  const { id, name, url, description } = req.body;
  const db = getLaunchDb();
  db.prepare('UPDATE projects SET name = ?, url = ?, description = ? WHERE id = ?').run(name, url, description, id);
  res.json({ success: true });
});

// Get milestones
app.get('/api/launch/milestones', (req, res) => {
  const db = getLaunchDb();
  const project = db.prepare('SELECT id FROM projects ORDER BY created_at DESC LIMIT 1').get() as { id: string } | undefined;
  if (!project) return res.json([]);

  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY id').all(project.id);
  res.json(milestones);
});

// Add milestone
app.post('/api/launch/milestones', (req, res) => {
  const { title } = req.body;
  const db = getLaunchDb();
  const project = db.prepare('SELECT id FROM projects ORDER BY created_at DESC LIMIT 1').get() as { id: string } | undefined;
  if (!project) return res.status(400).json({ error: 'No project' });

  db.prepare('INSERT INTO milestones (project_id, title) VALUES (?, ?)').run(project.id, title);
  res.json({ success: true });
});

// Update milestone
app.put('/api/launch/milestones/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const db = getLaunchDb();
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  db.prepare('UPDATE milestones SET status = ?, completed_at = ? WHERE id = ?').run(status, completedAt, id);
  res.json({ success: true });
});

// Get outreach contacts
app.get('/api/launch/outreach', (req, res) => {
  const db = getLaunchDb();
  const project = db.prepare('SELECT id FROM projects ORDER BY created_at DESC LIMIT 1').get() as { id: string } | undefined;
  if (!project) return res.json([]);

  const contacts = db.prepare('SELECT * FROM outreach WHERE project_id = ? ORDER BY created_at DESC').all(project.id);
  res.json(contacts);
});

// Add contact
app.post('/api/launch/outreach', (req, res) => {
  const { name, channel, contact_info, notes } = req.body;
  const db = getLaunchDb();
  const project = db.prepare('SELECT id FROM projects ORDER BY created_at DESC LIMIT 1').get() as { id: string } | undefined;
  if (!project) return res.status(400).json({ error: 'No project' });

  db.prepare(`
    INSERT INTO outreach (project_id, name, channel, contact_info, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(project.id, name, channel, contact_info || '', notes || '', new Date().toISOString());
  res.json({ success: true });
});

// Update contact
app.put('/api/launch/outreach/:id', (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  const db = getLaunchDb();
  db.prepare('UPDATE outreach SET status = ?, notes = ?, last_contact = ? WHERE id = ?')
    .run(status, notes, new Date().toISOString(), id);
  res.json({ success: true });
});

// Delete contact
app.delete('/api/launch/outreach/:id', (req, res) => {
  const { id } = req.params;
  const db = getLaunchDb();
  db.prepare('DELETE FROM outreach WHERE id = ?').run(id);
  res.json({ success: true });
});

// Get learnings
app.get('/api/launch/learnings', (req, res) => {
  const db = getLaunchDb();
  const project = db.prepare('SELECT id FROM projects ORDER BY created_at DESC LIMIT 1').get() as { id: string } | undefined;
  if (!project) return res.json([]);

  const learnings = db.prepare('SELECT * FROM learnings WHERE project_id = ? ORDER BY created_at DESC').all(project.id);
  res.json(learnings);
});

// Add learning
app.post('/api/launch/learnings', (req, res) => {
  const { category, content, source } = req.body;
  const db = getLaunchDb();
  const project = db.prepare('SELECT id FROM projects ORDER BY created_at DESC LIMIT 1').get() as { id: string } | undefined;
  if (!project) return res.status(400).json({ error: 'No project' });

  db.prepare(`
    INSERT INTO learnings (project_id, category, content, source, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(project.id, category, content, source || '', new Date().toISOString());
  res.json({ success: true });
});

// Get metrics
app.get('/api/launch/metrics', (req, res) => {
  const db = getLaunchDb();
  const project = db.prepare('SELECT id FROM projects ORDER BY created_at DESC LIMIT 1').get() as { id: string } | undefined;
  if (!project) return res.json([]);

  const metrics = db.prepare(`
    SELECT metric_name, value, MAX(recorded_at) as recorded_at
    FROM metrics WHERE project_id = ?
    GROUP BY metric_name
  `).all(project.id);
  res.json(metrics);
});

// Record metric
app.post('/api/launch/metrics', (req, res) => {
  const { metric_name, value } = req.body;
  const db = getLaunchDb();
  const project = db.prepare('SELECT id FROM projects ORDER BY created_at DESC LIMIT 1').get() as { id: string } | undefined;
  if (!project) return res.status(400).json({ error: 'No project' });

  db.prepare(`
    INSERT INTO metrics (project_id, metric_name, value, recorded_at)
    VALUES (?, ?, ?, ?)
  `).run(project.id, metric_name, value, new Date().toISOString());
  res.json({ success: true });
});

// Dashboard summary
app.get('/api/launch/summary', (req, res) => {
  const db = getLaunchDb();
  const project = db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT 1').get() as any;
  if (!project) return res.json(null);

  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ?').all(project.id) as any[];
  const contacts = db.prepare('SELECT * FROM outreach WHERE project_id = ?').all(project.id) as any[];
  const learnings = db.prepare('SELECT * FROM learnings WHERE project_id = ?').all(project.id) as any[];
  const metrics = db.prepare(`
    SELECT metric_name, value FROM metrics WHERE project_id = ?
    GROUP BY metric_name HAVING MAX(recorded_at)
  `).all(project.id) as any[];

  res.json({
    project,
    milestones: {
      total: milestones.length,
      completed: milestones.filter(m => m.status === 'completed').length,
      inProgress: milestones.filter(m => m.status === 'in_progress').length,
      pending: milestones.filter(m => m.status === 'pending').length,
      items: milestones
    },
    outreach: {
      total: contacts.length,
      contacted: contacts.filter(c => c.status !== 'not_contacted').length,
      responded: contacts.filter(c => ['responded', 'interested', 'converted'].includes(c.status)).length,
      converted: contacts.filter(c => c.status === 'converted').length,
      items: contacts
    },
    learnings,
    metrics
  });
});

// Serve the main HTML
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 My Team Office is running!`);
  console.log(`\n   Open: http://localhost:${PORT}\n`);
});
