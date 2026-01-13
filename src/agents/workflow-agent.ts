import { BaseAgent } from '../core/base-agent.js';
import { saveTask, getTasks, updateTask } from '../memory/database.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { AgentConfig, Tool, Task, AgentRole } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKFLOWS_DIR = join(__dirname, '../../data/workflows');

const WORKFLOW_AGENT_PROMPT = `You are the Workflow Agent - a productivity automation expert.

Your responsibilities:
1. Manage and track tasks across all projects
2. Create repeatable workflows for common processes
3. Set up automated sequences (e.g., "when X happens, do Y")
4. Help plan and break down large projects
5. Track deadlines and priorities
6. Suggest process improvements

You have tools to:
- Manage tasks (create, update, list)
- Save and run workflow templates
- Schedule reminders and follow-ups

Be proactive about:
- Breaking large tasks into smaller steps
- Identifying patterns that could be automated
- Following up on incomplete tasks

Help the user work smarter, not harder.`;

interface Workflow {
  name: string;
  description: string;
  steps: {
    action: string;
    agent?: AgentRole;
    params?: Record<string, unknown>;
  }[];
}

const createTools = (): Tool[] => [
  {
    name: 'create_task',
    description: 'Create a new task',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Task description' },
        assignTo: {
          type: 'string',
          enum: ['orchestrator', 'dev', 'research', 'comms', 'workflow'],
          description: 'Agent to assign to'
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Priority level'
        }
      },
      required: ['description']
    },
    execute: async (input: Record<string, unknown>) => {
      const task = saveTask({
        description: input.description as string,
        status: 'pending',
        assignedTo: input.assignTo as AgentRole | undefined
      });
      return `Task created: ${task.id}\nDescription: ${task.description}\nAssigned to: ${task.assignedTo || 'unassigned'}`;
    }
  },
  {
    name: 'list_tasks',
    description: 'List tasks with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'failed'],
          description: 'Filter by status'
        },
        assignedTo: {
          type: 'string',
          enum: ['orchestrator', 'dev', 'research', 'comms', 'workflow'],
          description: 'Filter by agent'
        }
      }
    },
    execute: async (input: Record<string, unknown>) => {
      const tasks = getTasks(
        input.status as Task['status'] | undefined,
        input.assignedTo as AgentRole | undefined
      );
      if (tasks.length === 0) return 'No tasks found.';

      const grouped = tasks.reduce((acc, t) => {
        const status = t.status;
        acc[status] = acc[status] || [];
        acc[status].push(t);
        return acc;
      }, {} as Record<string, Task[]>);

      let output = '';
      for (const [status, statusTasks] of Object.entries(grouped)) {
        output += `\n## ${status.toUpperCase()}\n`;
        for (const t of statusTasks) {
          output += `- [${t.id.slice(-6)}] ${t.description}`;
          if (t.assignedTo) output += ` (@${t.assignedTo})`;
          output += '\n';
        }
      }
      return output;
    }
  },
  {
    name: 'update_task',
    description: 'Update task status',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (can be partial)' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'failed'],
          description: 'New status'
        },
        result: { type: 'string', description: 'Completion notes' }
      },
      required: ['taskId', 'status']
    },
    execute: async (input: Record<string, unknown>) => {
      const taskIdPart = input.taskId as string;
      const tasks = getTasks();
      const task = tasks.find(t => t.id.includes(taskIdPart));

      if (!task) return `Task not found: ${taskIdPart}`;

      updateTask(task.id, {
        status: input.status as Task['status'],
        result: input.result as string | undefined,
        completedAt: input.status === 'completed' ? new Date() : undefined
      });

      return `Task updated: ${task.description} -> ${input.status}`;
    }
  },
  {
    name: 'save_workflow',
    description: 'Save a reusable workflow template',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workflow name' },
        description: { type: 'string', description: 'What this workflow does' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              agent: { type: 'string' },
              params: { type: 'object' }
            }
          },
          description: 'Workflow steps'
        }
      },
      required: ['name', 'description', 'steps']
    },
    execute: async (input: Record<string, unknown>) => {
      try {
        await mkdir(WORKFLOWS_DIR, { recursive: true });
        const workflow: Workflow = {
          name: input.name as string,
          description: input.description as string,
          steps: input.steps as Workflow['steps']
        };
        const filename = `${(input.name as string).toLowerCase().replace(/\s+/g, '-')}.json`;
        await writeFile(
          join(WORKFLOWS_DIR, filename),
          JSON.stringify(workflow, null, 2)
        );
        return `Workflow saved: ${filename}`;
      } catch (error) {
        return `Error saving workflow: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  },
  {
    name: 'list_workflows',
    description: 'List saved workflow templates',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    execute: async () => {
      try {
        await mkdir(WORKFLOWS_DIR, { recursive: true });
        const { readdir } = await import('fs/promises');
        const files = await readdir(WORKFLOWS_DIR);
        const workflows: string[] = [];

        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = await readFile(join(WORKFLOWS_DIR, file), 'utf-8');
            const workflow = JSON.parse(content) as Workflow;
            workflows.push(`- ${workflow.name}: ${workflow.description}`);
          }
        }

        return workflows.length > 0
          ? workflows.join('\n')
          : 'No workflows saved yet.';
      } catch {
        return 'No workflows saved yet.';
      }
    }
  },
  {
    name: 'break_down_project',
    description: 'Break a large project into smaller tasks',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project description' },
        createTasks: {
          type: 'boolean',
          description: 'Whether to create the tasks in the system'
        }
      },
      required: ['project']
    },
    execute: async (input: Record<string, unknown>) => {
      // This will be handled by the agent's reasoning
      return `Analyzing project: ${input.project}\nPlease provide a breakdown.`;
    }
  }
];

export class WorkflowAgent extends BaseAgent {
  constructor(sessionId?: string) {
    const config: AgentConfig = {
      name: 'Workflow',
      role: 'workflow',
      description: 'Productivity and automation specialist',
      systemPrompt: WORKFLOW_AGENT_PROMPT,
      model: 'claude-sonnet-4-20250514',
      tools: createTools()
    };
    super(config, sessionId);
  }
}

export default WorkflowAgent;
