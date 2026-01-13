import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Memory, Task, UserPreference, Message, AgentRole } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '../../data/team.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    initializeSchema();
  }
  return db;
}

function initializeSchema(): void {
  const database = db!;

  database.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      agent_role TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_to TEXT,
      result TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      category TEXT NOT NULL,
      learned_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      agent_role TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_role);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
  `);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Memory operations
export function saveMemory(memory: Omit<Memory, 'id' | 'createdAt'>): Memory {
  const database = getDb();
  const id = generateId();
  const createdAt = new Date();

  database.prepare(`
    INSERT INTO memories (id, type, content, metadata, agent_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, memory.type, memory.content, JSON.stringify(memory.metadata), memory.agentRole, createdAt.toISOString());

  return { ...memory, id, createdAt };
}

export function getMemories(type?: Memory['type'], agentRole?: AgentRole, limit = 50): Memory[] {
  const database = getDb();
  let query = 'SELECT * FROM memories WHERE 1=1';
  const params: unknown[] = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (agentRole) {
    query += ' AND agent_role = ?';
    params.push(agentRole);
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = database.prepare(query).all(...params) as Array<{
    id: string;
    type: string;
    content: string;
    metadata: string;
    agent_role: string;
    created_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    type: row.type as Memory['type'],
    content: row.content,
    metadata: JSON.parse(row.metadata || '{}'),
    agentRole: row.agent_role as AgentRole,
    createdAt: new Date(row.created_at)
  }));
}

export function searchMemories(query: string, limit = 20): Memory[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM memories
    WHERE content LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(`%${query}%`, limit) as Array<{
    id: string;
    type: string;
    content: string;
    metadata: string;
    agent_role: string;
    created_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    type: row.type as Memory['type'],
    content: row.content,
    metadata: JSON.parse(row.metadata || '{}'),
    agentRole: row.agent_role as AgentRole,
    createdAt: new Date(row.created_at)
  }));
}

// Task operations
export function saveTask(task: Omit<Task, 'id' | 'createdAt'>): Task {
  const database = getDb();
  const id = generateId();
  const createdAt = new Date();

  database.prepare(`
    INSERT INTO tasks (id, description, status, assigned_to, result, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, task.description, task.status, task.assignedTo, task.result, createdAt.toISOString(), task.completedAt?.toISOString());

  return { ...task, id, createdAt };
}

export function updateTask(id: string, updates: Partial<Pick<Task, 'status' | 'result' | 'completedAt'>>): void {
  const database = getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.status) {
    sets.push('status = ?');
    params.push(updates.status);
  }
  if (updates.result !== undefined) {
    sets.push('result = ?');
    params.push(updates.result);
  }
  if (updates.completedAt) {
    sets.push('completed_at = ?');
    params.push(updates.completedAt.toISOString());
  }

  params.push(id);
  database.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function getTasks(status?: Task['status'], assignedTo?: AgentRole): Task[] {
  const database = getDb();
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params: unknown[] = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (assignedTo) {
    query += ' AND assigned_to = ?';
    params.push(assignedTo);
  }
  query += ' ORDER BY created_at DESC';

  const rows = database.prepare(query).all(...params) as Array<{
    id: string;
    description: string;
    status: string;
    assigned_to: string;
    result: string;
    created_at: string;
    completed_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    description: row.description,
    status: row.status as Task['status'],
    assignedTo: row.assigned_to as AgentRole,
    result: row.result,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined
  }));
}

// Preference operations
export function savePreference(pref: Omit<UserPreference, 'learnedAt'>): UserPreference {
  const database = getDb();
  const learnedAt = new Date();

  database.prepare(`
    INSERT OR REPLACE INTO preferences (key, value, category, learned_at)
    VALUES (?, ?, ?, ?)
  `).run(pref.key, pref.value, pref.category, learnedAt.toISOString());

  return { ...pref, learnedAt };
}

export function getPreference(key: string): UserPreference | null {
  const database = getDb();
  const row = database.prepare('SELECT * FROM preferences WHERE key = ?').get(key) as {
    key: string;
    value: string;
    category: string;
    learned_at: string;
  } | undefined;

  if (!row) return null;

  return {
    key: row.key,
    value: row.value,
    category: row.category,
    learnedAt: new Date(row.learned_at)
  };
}

export function getPreferencesByCategory(category: string): UserPreference[] {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM preferences WHERE category = ?').all(category) as Array<{
    key: string;
    value: string;
    category: string;
    learned_at: string;
  }>;

  return rows.map(row => ({
    key: row.key,
    value: row.value,
    category: row.category,
    learnedAt: new Date(row.learned_at)
  }));
}

export function getAllPreferences(): UserPreference[] {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM preferences ORDER BY category, key').all() as Array<{
    key: string;
    value: string;
    category: string;
    learned_at: string;
  }>;

  return rows.map(row => ({
    key: row.key,
    value: row.value,
    category: row.category,
    learnedAt: new Date(row.learned_at)
  }));
}

// Conversation operations
export function saveConversationMessage(sessionId: string, message: Omit<Message, 'timestamp'>): Message {
  const database = getDb();
  const timestamp = new Date();

  database.prepare(`
    INSERT INTO conversations (session_id, role, content, agent_role, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, message.role, message.content, message.agentRole, timestamp.toISOString());

  return { ...message, timestamp };
}

export function getConversationHistory(sessionId: string, limit = 50): Message[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT * FROM conversations
    WHERE session_id = ?
    ORDER BY timestamp ASC
    LIMIT ?
  `).all(sessionId, limit) as Array<{
    role: string;
    content: string;
    agent_role: string;
    timestamp: string;
  }>;

  return rows.map(row => ({
    role: row.role as Message['role'],
    content: row.content,
    agentRole: row.agent_role as AgentRole,
    timestamp: new Date(row.timestamp)
  }));
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
