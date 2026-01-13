import { BaseAgent } from '../core/base-agent.js';
import { saveTask, getTasks, updateTask, savePreference } from '../memory/database.js';
import type { AgentConfig, Tool, AgentRole, Task } from '../types/index.js';

const ORCHESTRATOR_PROMPT = `You are my personal assistant. I'm your boss. Get stuff done.

RULES:
- Keep responses SHORT (1-3 sentences)
- Take action, don't explain what you could do
- Never list your capabilities
- Never ask "how can I help" - just help
- If you need info to act, ask ONE specific question

You can delegate to specialists:
- dev: code stuff
- research: look things up
- comms: write emails/docs
- workflow: manage tasks

Use [DELEGATE:agent_role] when handing off.
Use [REMEMBER:key|value] to save my preferences.`;

const createTools = (): Tool[] => [
  {
    name: 'create_task',
    description: 'Create a new task and optionally assign it to a specialist agent',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Task description' },
        assignTo: {
          type: 'string',
          enum: ['dev', 'research', 'comms', 'workflow'],
          description: 'Agent to assign the task to'
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
      return `Task created: ${task.id} - ${task.description}`;
    }
  },
  {
    name: 'list_tasks',
    description: 'List current tasks, optionally filtered by status or agent',
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
          enum: ['dev', 'research', 'comms', 'workflow'],
          description: 'Filter by assigned agent'
        }
      }
    },
    execute: async (input: Record<string, unknown>) => {
      const tasks = getTasks(
        input.status as Task['status'] | undefined,
        input.assignedTo as AgentRole | undefined
      );
      if (tasks.length === 0) return 'No tasks found.';
      return tasks.map(t => `[${t.status}] ${t.id}: ${t.description}`).join('\n');
    }
  },
  {
    name: 'update_task',
    description: 'Update a task status or mark it complete',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to update' },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'failed'],
          description: 'New status'
        },
        result: { type: 'string', description: 'Result or notes about the task' }
      },
      required: ['taskId', 'status']
    },
    execute: async (input: Record<string, unknown>) => {
      updateTask(input.taskId as string, {
        status: input.status as Task['status'],
        result: input.result as string | undefined,
        completedAt: input.status === 'completed' ? new Date() : undefined
      });
      return `Task ${input.taskId} updated to ${input.status}`;
    }
  },
  {
    name: 'save_preference',
    description: 'Save a user preference that has been learned',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Preference key (e.g., "coding_style")' },
        value: { type: 'string', description: 'Preference value' },
        category: {
          type: 'string',
          description: 'Category (e.g., "development", "communication", "scheduling")'
        }
      },
      required: ['key', 'value', 'category']
    },
    execute: async (input: Record<string, unknown>) => {
      savePreference({
        key: input.key as string,
        value: input.value as string,
        category: input.category as string
      });
      return `Preference saved: ${input.key} = ${input.value}`;
    }
  }
];

export class OrchestratorAgent extends BaseAgent {
  constructor(sessionId?: string) {
    const config: AgentConfig = {
      name: 'Orchestrator',
      role: 'orchestrator',
      description: 'Central coordinator that routes tasks and learns user preferences',
      systemPrompt: ORCHESTRATOR_PROMPT,
      model: 'claude-sonnet-4-20250514',
      tools: createTools()
    };
    super(config, sessionId);
  }
}

// CLI for standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const readline = await import('readline');
  const chalk = (await import('chalk')).default;

  const agent = new OrchestratorAgent();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(chalk.blue('\n=== Orchestrator Agent ==='));
  console.log(chalk.gray('Your central coordinator. Type "exit" to quit.\n'));

  const prompt = () => {
    rl.question(chalk.green('You: '), async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log(chalk.blue('\nGoodbye!'));
        rl.close();
        process.exit(0);
      }

      try {
        const response = await agent.chat(input);
        console.log(chalk.blue(`\nOrchestrator: ${response.content}\n`));
        if (response.delegateTo) {
          console.log(chalk.yellow(`[Would delegate to: ${response.delegateTo}]\n`));
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
      }
      prompt();
    });
  };

  prompt();
}
