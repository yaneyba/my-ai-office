import chalk from 'chalk';
import inquirer from 'inquirer';
import { OrchestratorAgent } from './agents/orchestrator.js';
import { DevAgent } from './agents/dev-agent.js';
import { ResearchAgent } from './agents/research-agent.js';
import { CommsAgent } from './agents/comms-agent.js';
import { WorkflowAgent } from './agents/workflow-agent.js';
import { getTasks, getMemories, getAllPreferences, getConversationHistory } from './memory/database.js';
import type { AgentRole } from './types/index.js';
import { BaseAgent } from './core/base-agent.js';

const AGENTS = {
  orchestrator: { icon: '🎯', name: 'Orchestrator', color: chalk.blue, Agent: OrchestratorAgent },
  dev: { icon: '💻', name: 'Dev', color: chalk.green, Agent: DevAgent },
  research: { icon: '🔍', name: 'Research', color: chalk.yellow, Agent: ResearchAgent },
  comms: { icon: '✉️', name: 'Comms', color: chalk.magenta, Agent: CommsAgent },
  workflow: { icon: '⚡', name: 'Workflow', color: chalk.cyan, Agent: WorkflowAgent }
};

function clearScreen(): void {
  console.clear();
}

function printHeader(): void {
  console.log(chalk.bold.white(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   ${chalk.blue('███╗   ███╗██╗   ██╗    ████████╗███████╗ █████╗ ███╗   ███╗')}   ║
║   ${chalk.blue('████╗ ████║╚██╗ ██╔╝    ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║')}   ║
║   ${chalk.blue('██╔████╔██║ ╚████╔╝        ██║   █████╗  ███████║██╔████╔██║')}   ║
║   ${chalk.blue('██║╚██╔╝██║  ╚██╔╝         ██║   ██╔══╝  ██╔══██║██║╚██╔╝██║')}   ║
║   ${chalk.blue('██║ ╚═╝ ██║   ██║          ██║   ███████╗██║  ██║██║ ╚═╝ ██║')}   ║
║   ${chalk.blue('╚═╝     ╚═╝   ╚═╝          ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝')}   ║
║                                                                  ║
║                    ${chalk.gray('Your Personal AI Office')}                       ║
╚══════════════════════════════════════════════════════════════════╝
`));
}

function printAgentStatus(): void {
  console.log(chalk.bold('\n📋 AGENT STATUS\n'));

  const box = (content: string, color: (text: string) => string, width: number = 20): string => {
    const lines = content.split('\n');
    const top = '┌' + '─'.repeat(width - 2) + '┐';
    const bottom = '└' + '─'.repeat(width - 2) + '┘';
    const middle = lines.map(line => {
      const padded = line.padEnd(width - 4);
      return '│ ' + color(padded) + ' │';
    }).join('\n');
    return color(top) + '\n' + middle + '\n' + color(bottom);
  };

  // Print agents in a row
  const agentBoxes = Object.entries(AGENTS).map(([_, agent]) => {
    return box(`${agent.icon} ${agent.name}\n   Ready`, agent.color, 16);
  });

  // Print boxes side by side
  const lines: string[][] = agentBoxes.map(b => b.split('\n'));
  for (let i = 0; i < lines[0].length; i++) {
    console.log('  ' + lines.map(l => l[i]).join('  '));
  }
}

function printTasksSummary(): void {
  const tasks = getTasks();
  const pending = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  console.log(chalk.bold('\n\n📊 TASK OVERVIEW\n'));
  console.log(`  ${chalk.yellow('●')} Pending: ${pending}    ${chalk.blue('●')} In Progress: ${inProgress}    ${chalk.green('●')} Completed: ${completed}`);

  if (tasks.length > 0) {
    console.log(chalk.gray('\n  Recent tasks:'));
    tasks.slice(0, 5).forEach(t => {
      const status = t.status === 'completed' ? chalk.green('✓')
        : t.status === 'in_progress' ? chalk.blue('◐')
          : chalk.yellow('○');
      console.log(`    ${status} ${t.description.slice(0, 50)}${t.description.length > 50 ? '...' : ''}`);
    });
  }
}

function printMemorySummary(): void {
  const memories = getMemories(undefined, undefined, 100);
  const preferences = getAllPreferences();

  console.log(chalk.bold('\n\n🧠 MEMORY\n'));
  console.log(`  Facts: ${memories.filter(m => m.type === 'fact').length}    Preferences: ${preferences.length}    Conversations: ${memories.filter(m => m.type === 'conversation').length}`);

  if (preferences.length > 0) {
    console.log(chalk.gray('\n  Known preferences:'));
    preferences.slice(0, 3).forEach(p => {
      console.log(`    • ${p.key}: ${p.value}`);
    });
  }
}

function printMenu(): void {
  console.log(chalk.bold('\n\n🚀 QUICK ACTIONS\n'));
  console.log('  ' + chalk.gray('[1]') + ' Chat with team      ' + chalk.gray('[2]') + ' Talk to specific agent');
  console.log('  ' + chalk.gray('[3]') + ' View all tasks      ' + chalk.gray('[4]') + ' View preferences');
  console.log('  ' + chalk.gray('[5]') + ' Refresh             ' + chalk.gray('[q]') + ' Quit');
}

async function chatWithTeam(sessionId: string): Promise<void> {
  clearScreen();
  console.log(chalk.bold.blue('\n💬 TEAM CHAT\n'));
  console.log(chalk.gray('The Orchestrator will route your request to the right agent.'));
  console.log(chalk.gray('Type "back" to return to the office.\n'));

  const orchestrator = new OrchestratorAgent(sessionId);

  const prompt = async (): Promise<void> => {
    const { message } = await inquirer.prompt([{
      type: 'input',
      name: 'message',
      message: chalk.green('You:'),
      prefix: ''
    }]);

    if (message.toLowerCase() === 'back') return;

    try {
      console.log(chalk.gray('\nThinking...\n'));
      const response = await orchestrator.chat(message);
      console.log(chalk.blue('Orchestrator:'), response.content);

      if (response.delegateTo) {
        console.log(chalk.yellow(`\n[Delegating to ${response.delegateTo} agent...]`));
        const agentInfo = AGENTS[response.delegateTo as keyof typeof AGENTS];
        if (agentInfo) {
          const agent = new agentInfo.Agent(sessionId);
          const delegatedResponse = await agent.chat(message);
          console.log(agentInfo.color(`\n${agentInfo.name}:`), delegatedResponse.content);
        }
      }
      console.log('');
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }

    await prompt();
  };

  await prompt();
}

async function chatWithAgent(sessionId: string): Promise<void> {
  clearScreen();
  console.log(chalk.bold.blue('\n👤 DIRECT AGENT CHAT\n'));

  const { agent } = await inquirer.prompt([{
    type: 'list',
    name: 'agent',
    message: 'Which agent do you want to talk to?',
    choices: Object.entries(AGENTS).map(([key, value]) => ({
      name: `${value.icon} ${value.name}`,
      value: key
    }))
  }]);

  const agentInfo = AGENTS[agent as keyof typeof AGENTS];
  const agentInstance = new agentInfo.Agent(sessionId) as BaseAgent;

  console.log(chalk.gray(`\nYou're now chatting with ${agentInfo.name}. Type "back" to return.\n`));

  const prompt = async (): Promise<void> => {
    const { message } = await inquirer.prompt([{
      type: 'input',
      name: 'message',
      message: chalk.green('You:'),
      prefix: ''
    }]);

    if (message.toLowerCase() === 'back') return;

    try {
      console.log(chalk.gray('\nThinking...\n'));
      const response = await agentInstance.chat(message);
      console.log(agentInfo.color(`${agentInfo.name}:`), response.content, '\n');
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }

    await prompt();
  };

  await prompt();
}

async function viewTasks(): Promise<void> {
  clearScreen();
  console.log(chalk.bold.blue('\n📋 ALL TASKS\n'));

  const tasks = getTasks();

  if (tasks.length === 0) {
    console.log(chalk.gray('No tasks yet. Start chatting with your team to create tasks!\n'));
  } else {
    const grouped: Record<string, typeof tasks> = {};
    for (const task of tasks) {
      grouped[task.status] = grouped[task.status] || [];
      grouped[task.status].push(task);
    }

    for (const [status, statusTasks] of Object.entries(grouped)) {
      const icon = status === 'completed' ? '✅'
        : status === 'in_progress' ? '🔄'
          : status === 'failed' ? '❌'
            : '⏳';
      console.log(chalk.bold(`\n${icon} ${status.toUpperCase()}\n`));
      for (const task of statusTasks) {
        console.log(`  • ${task.description}`);
        if (task.assignedTo) console.log(chalk.gray(`    Assigned to: ${task.assignedTo}`));
        if (task.result) console.log(chalk.gray(`    Result: ${task.result}`));
      }
    }
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: chalk.gray('Press Enter to continue...'),
    prefix: ''
  }]);
}

async function viewPreferences(): Promise<void> {
  clearScreen();
  console.log(chalk.bold.blue('\n⚙️ LEARNED PREFERENCES\n'));

  const preferences = getAllPreferences();

  if (preferences.length === 0) {
    console.log(chalk.gray('No preferences learned yet. As you interact with your team,'));
    console.log(chalk.gray('they will learn and remember your preferences.\n'));
  } else {
    const grouped: Record<string, typeof preferences> = {};
    for (const pref of preferences) {
      grouped[pref.category] = grouped[pref.category] || [];
      grouped[pref.category].push(pref);
    }

    for (const [category, categoryPrefs] of Object.entries(grouped)) {
      console.log(chalk.bold(`\n📁 ${category.toUpperCase()}\n`));
      for (const pref of categoryPrefs) {
        console.log(`  ${chalk.cyan(pref.key)}: ${pref.value}`);
      }
    }
  }

  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: chalk.gray('Press Enter to continue...'),
    prefix: ''
  }]);
}

async function showDashboard(sessionId: string): Promise<void> {
  clearScreen();
  printHeader();
  printAgentStatus();
  printTasksSummary();
  printMemorySummary();
  printMenu();

  const { action } = await inquirer.prompt([{
    type: 'input',
    name: 'action',
    message: chalk.gray('Select action:'),
    prefix: ''
  }]);

  switch (action) {
    case '1':
      await chatWithTeam(sessionId);
      break;
    case '2':
      await chatWithAgent(sessionId);
      break;
    case '3':
      await viewTasks();
      break;
    case '4':
      await viewPreferences();
      break;
    case '5':
      break;
    case 'q':
    case 'Q':
      console.log(chalk.blue('\nGoodbye! Your team will be here when you need them.\n'));
      process.exit(0);
    default:
      break;
  }

  await showDashboard(sessionId);
}

async function main(): Promise<void> {
  const sessionId = `office-${Date.now()}`;

  console.log(chalk.gray('Starting My Team Office...\n'));

  await showDashboard(sessionId);
}

main().catch(console.error);
