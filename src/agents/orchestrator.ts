import { BaseAgent } from '../core/base-agent.js';
import { saveTask, getTasks, updateTask, savePreference } from '../memory/database.js';
import type { AgentConfig, Tool, AgentRole, Task } from '../types/index.js';

const ORCHESTRATOR_PROMPT = `You are the Orchestrator - the central coordinator of a personal AI agent team.

Your responsibilities:
1. Understand the user's intent and route tasks to the appropriate specialized agent
2. Learn and remember user preferences over time
3. Coordinate multi-agent workflows when tasks require collaboration
4. Maintain context across conversations
5. Provide direct answers for simple queries that don't need specialist agents

Available specialist agents you can delegate to:
- dev: Development tasks (coding, debugging, architecture, testing, deployments)
- research: Research and learning (web research, summarization, studying topics)
- comms: Communication (emails, reports, documentation, presentations)
- workflow: Automation (task management, scheduling, repetitive processes)

When you need to delegate, include [DELEGATE:agent_role] in your response.
When you learn something about the user's preferences, include [REMEMBER:preference|description].

Be conversational, helpful, and proactive about learning the user's work style.`;

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
