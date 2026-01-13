export type AgentRole = 'orchestrator' | 'dev' | 'research' | 'comms' | 'workflow';

export interface AgentConfig {
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
  model?: string;
  tools?: Tool[];
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentRole?: AgentRole;
}

export interface Memory {
  id: string;
  type: 'preference' | 'fact' | 'task' | 'conversation';
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  agentRole?: AgentRole;
}

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: AgentRole;
  result?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface UserPreference {
  key: string;
  value: string;
  category: string;
  learnedAt: Date;
}

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  delegateTo?: AgentRole;
  memoriesToStore?: Omit<Memory, 'id' | 'createdAt'>[];
}

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: string;
}
