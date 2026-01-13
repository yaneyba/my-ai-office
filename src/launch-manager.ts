import chalk from 'chalk';
import inquirer from 'inquirer';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { OrchestratorAgent } from './agents/orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '../data/launch.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    initSchema();
  }
  return db;
}

function initSchema(): void {
  db!.exec(`
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
      due_date TEXT,
      completed_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
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
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS learnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      value INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      action_items TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);
}

// Project Management
function createProject(name: string, url: string, description: string): string {
  const id = `proj_${Date.now()}`;
  getDb().prepare(`
    INSERT INTO projects (id, name, url, description, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, url, description, new Date().toISOString());
  return id;
}

function getProject(id: string) {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function getActiveProject() {
  return getDb().prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT 1').get() as {
    id: string; name: string; url: string; description: string;
  } | undefined;
}

// Milestones
function addMilestone(projectId: string, title: string, dueDate?: string): void {
  getDb().prepare(`
    INSERT INTO milestones (project_id, title, due_date)
    VALUES (?, ?, ?)
  `).run(projectId, title, dueDate);
}

function getMilestones(projectId: string) {
  return getDb().prepare(`
    SELECT * FROM milestones WHERE project_id = ? ORDER BY
    CASE status WHEN 'in_progress' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END
  `).all(projectId) as Array<{
    id: number; title: string; status: string; due_date: string; completed_at: string;
  }>;
}

function updateMilestone(id: number, status: string): void {
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  getDb().prepare(`
    UPDATE milestones SET status = ?, completed_at = ? WHERE id = ?
  `).run(status, completedAt, id);
}

// Outreach
function addContact(projectId: string, name: string, channel: string, contactInfo: string): void {
  getDb().prepare(`
    INSERT INTO outreach (project_id, name, channel, contact_info, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(projectId, name, channel, contactInfo, new Date().toISOString());
}

function getContacts(projectId: string) {
  return getDb().prepare(`
    SELECT * FROM outreach WHERE project_id = ? ORDER BY created_at DESC
  `).all(projectId) as Array<{
    id: number; name: string; channel: string; contact_info: string;
    status: string; notes: string; last_contact: string;
  }>;
}

function updateContact(id: number, status: string, notes?: string): void {
  getDb().prepare(`
    UPDATE outreach SET status = ?, notes = ?, last_contact = ? WHERE id = ?
  `).run(status, notes, new Date().toISOString(), id);
}

// Learnings
function addLearning(projectId: string, category: string, content: string, source?: string): void {
  getDb().prepare(`
    INSERT INTO learnings (project_id, category, content, source, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(projectId, category, content, source, new Date().toISOString());
}

function getLearnings(projectId: string) {
  return getDb().prepare(`
    SELECT * FROM learnings WHERE project_id = ? ORDER BY created_at DESC
  `).all(projectId) as Array<{
    id: number; category: string; content: string; source: string; created_at: string;
  }>;
}

// Metrics
function recordMetric(projectId: string, name: string, value: number): void {
  getDb().prepare(`
    INSERT INTO metrics (project_id, metric_name, value, recorded_at)
    VALUES (?, ?, ?, ?)
  `).run(projectId, name, value, new Date().toISOString());
}

function getMetrics(projectId: string) {
  return getDb().prepare(`
    SELECT metric_name, value, recorded_at FROM metrics
    WHERE project_id = ? ORDER BY recorded_at DESC
  `).all(projectId) as Array<{
    metric_name: string; value: number; recorded_at: string;
  }>;
}

function getLatestMetrics(projectId: string) {
  return getDb().prepare(`
    SELECT metric_name, value, MAX(recorded_at) as recorded_at
    FROM metrics WHERE project_id = ?
    GROUP BY metric_name
  `).all(projectId) as Array<{
    metric_name: string; value: number; recorded_at: string;
  }>;
}

// Conversations
function saveConversation(projectId: string, summary: string, actionItems?: string): void {
  getDb().prepare(`
    INSERT INTO conversations (project_id, summary, action_items, created_at)
    VALUES (?, ?, ?, ?)
  `).run(projectId, summary, actionItems, new Date().toISOString());
}

function getConversations(projectId: string) {
  return getDb().prepare(`
    SELECT * FROM conversations WHERE project_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(projectId) as Array<{
    id: number; summary: string; action_items: string; created_at: string;
  }>;
}

// UI Components
function clearScreen(): void {
  console.clear();
}

function printHeader(projectName: string): void {
  console.log(chalk.bold.cyan(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ${chalk.white('🚀 LAUNCH MANAGER')}                                            ║
║   ${chalk.gray(projectName.padEnd(50))}    ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`));
}

function printDashboard(projectId: string): void {
  const milestones = getMilestones(projectId);
  const contacts = getContacts(projectId);
  const metrics = getLatestMetrics(projectId);
  const learnings = getLearnings(projectId);

  // Milestones Summary
  const completed = milestones.filter(m => m.status === 'completed').length;
  const inProgress = milestones.filter(m => m.status === 'in_progress').length;
  const pending = milestones.filter(m => m.status === 'pending').length;

  console.log(chalk.bold('\n📋 MILESTONES'));
  console.log(`   ${chalk.green('✓')} ${completed} done   ${chalk.blue('◐')} ${inProgress} active   ${chalk.yellow('○')} ${pending} pending\n`);

  milestones.slice(0, 5).forEach(m => {
    const icon = m.status === 'completed' ? chalk.green('✓')
      : m.status === 'in_progress' ? chalk.blue('◐')
      : chalk.yellow('○');
    console.log(`   ${icon} ${m.title}`);
  });

  // Outreach Summary
  const contacted = contacts.filter(c => c.status !== 'not_contacted').length;
  const responded = contacts.filter(c => ['responded', 'interested', 'converted'].includes(c.status)).length;
  const converted = contacts.filter(c => c.status === 'converted').length;

  console.log(chalk.bold('\n\n👥 OUTREACH PIPELINE'));
  console.log(`   Total: ${contacts.length}   Contacted: ${contacted}   Responded: ${responded}   Converted: ${converted}\n`);

  const statusBar = (count: number, total: number, color: (text: string) => string) => {
    const width = 20;
    const filled = total > 0 ? Math.round((count / total) * width) : 0;
    return color('█'.repeat(filled)) + chalk.gray('░'.repeat(width - filled));
  };

  if (contacts.length > 0) {
    console.log(`   Response Rate: ${statusBar(responded, contacted || 1, chalk.cyan)} ${contacted > 0 ? Math.round((responded/contacted)*100) : 0}%`);
    console.log(`   Conversion:    ${statusBar(converted, contacts.length, chalk.green)} ${Math.round((converted/contacts.length)*100)}%`);
  }

  // Key Metrics
  console.log(chalk.bold('\n\n📊 KEY METRICS'));
  if (metrics.length === 0) {
    console.log(chalk.gray('   No metrics recorded yet'));
  } else {
    metrics.forEach(m => {
      console.log(`   ${m.metric_name}: ${chalk.cyan(m.value)}`);
    });
  }

  // Recent Learnings
  console.log(chalk.bold('\n\n💡 RECENT LEARNINGS'));
  if (learnings.length === 0) {
    console.log(chalk.gray('   No learnings recorded yet'));
  } else {
    learnings.slice(0, 3).forEach(l => {
      console.log(`   ${chalk.yellow('•')} [${l.category}] ${l.content.slice(0, 60)}${l.content.length > 60 ? '...' : ''}`);
    });
  }
}

function printMenu(): void {
  console.log(chalk.bold('\n\n⚡ ACTIONS\n'));
  console.log('   ' + chalk.gray('[1]') + ' Milestones      ' + chalk.gray('[2]') + ' Outreach      ' + chalk.gray('[3]') + ' Metrics');
  console.log('   ' + chalk.gray('[4]') + ' Learnings       ' + chalk.gray('[5]') + ' Ask AI        ' + chalk.gray('[6]') + ' Refresh');
  console.log('   ' + chalk.gray('[q]') + ' Quit');
}

// Interactive Screens
async function manageMilestones(projectId: string): Promise<void> {
  clearScreen();
  console.log(chalk.bold.cyan('\n📋 MILESTONES\n'));

  const milestones = getMilestones(projectId);

  if (milestones.length > 0) {
    milestones.forEach((m, i) => {
      const icon = m.status === 'completed' ? chalk.green('✓')
        : m.status === 'in_progress' ? chalk.blue('◐')
        : chalk.yellow('○');
      console.log(`   ${i + 1}. ${icon} ${m.title}`);
    });
  }

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What do you want to do?',
    choices: [
      { name: 'Add milestone', value: 'add' },
      { name: 'Update status', value: 'update' },
      { name: 'Back', value: 'back' }
    ]
  }]);

  if (action === 'add') {
    const { title } = await inquirer.prompt([{
      type: 'input',
      name: 'title',
      message: 'Milestone title:'
    }]);
    if (title) {
      addMilestone(projectId, title);
      console.log(chalk.green('\n✓ Milestone added'));
    }
  } else if (action === 'update' && milestones.length > 0) {
    const { milestoneId, status } = await inquirer.prompt([
      {
        type: 'list',
        name: 'milestoneId',
        message: 'Which milestone?',
        choices: milestones.map(m => ({ name: m.title, value: m.id }))
      },
      {
        type: 'list',
        name: 'status',
        message: 'New status:',
        choices: [
          { name: '○ Pending', value: 'pending' },
          { name: '◐ In Progress', value: 'in_progress' },
          { name: '✓ Completed', value: 'completed' }
        ]
      }
    ]);
    updateMilestone(milestoneId, status);
    console.log(chalk.green('\n✓ Status updated'));
  }

  await inquirer.prompt([{ type: 'input', name: 'continue', message: chalk.gray('Press Enter...'), prefix: '' }]);
}

async function manageOutreach(projectId: string): Promise<void> {
  clearScreen();
  console.log(chalk.bold.cyan('\n👥 OUTREACH TRACKING\n'));

  const contacts = getContacts(projectId);

  if (contacts.length > 0) {
    const statusIcon = (s: string) => {
      switch(s) {
        case 'not_contacted': return chalk.gray('○');
        case 'contacted': return chalk.yellow('●');
        case 'responded': return chalk.blue('●');
        case 'interested': return chalk.cyan('●');
        case 'converted': return chalk.green('★');
        case 'not_interested': return chalk.red('✗');
        default: return chalk.gray('○');
      }
    };

    contacts.forEach((c, i) => {
      console.log(`   ${i + 1}. ${statusIcon(c.status)} ${c.name} (${c.channel}) - ${c.status}`);
    });
  } else {
    console.log(chalk.gray('   No contacts yet'));
  }

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What do you want to do?',
    choices: [
      { name: 'Add contact', value: 'add' },
      { name: 'Update status', value: 'update' },
      { name: 'Back', value: 'back' }
    ]
  }]);

  if (action === 'add') {
    const { name, channel, contactInfo } = await inquirer.prompt([
      { type: 'input', name: 'name', message: 'Name:' },
      {
        type: 'list',
        name: 'channel',
        message: 'Channel:',
        choices: ['Facebook Group', 'Reddit', 'Email', 'LinkedIn', 'Referral', 'Other']
      },
      { type: 'input', name: 'contactInfo', message: 'Contact info (optional):' }
    ]);
    if (name) {
      addContact(projectId, name, channel, contactInfo);
      console.log(chalk.green('\n✓ Contact added'));
    }
  } else if (action === 'update' && contacts.length > 0) {
    const { contactId, status, notes } = await inquirer.prompt([
      {
        type: 'list',
        name: 'contactId',
        message: 'Which contact?',
        choices: contacts.map(c => ({ name: `${c.name} (${c.channel})`, value: c.id }))
      },
      {
        type: 'list',
        name: 'status',
        message: 'New status:',
        choices: [
          { name: '○ Not Contacted', value: 'not_contacted' },
          { name: '● Contacted', value: 'contacted' },
          { name: '● Responded', value: 'responded' },
          { name: '● Interested', value: 'interested' },
          { name: '★ Converted', value: 'converted' },
          { name: '✗ Not Interested', value: 'not_interested' }
        ]
      },
      { type: 'input', name: 'notes', message: 'Notes (optional):' }
    ]);
    updateContact(contactId, status, notes);
    console.log(chalk.green('\n✓ Contact updated'));
  }

  await inquirer.prompt([{ type: 'input', name: 'continue', message: chalk.gray('Press Enter...'), prefix: '' }]);
}

async function manageMetrics(projectId: string): Promise<void> {
  clearScreen();
  console.log(chalk.bold.cyan('\n📊 METRICS\n'));

  const metrics = getMetrics(projectId);
  const latest = getLatestMetrics(projectId);

  if (latest.length > 0) {
    console.log(chalk.bold('Current Values:\n'));
    latest.forEach(m => {
      console.log(`   ${m.metric_name}: ${chalk.cyan(m.value)}`);
    });
  }

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What do you want to do?',
    choices: [
      { name: 'Record metric', value: 'add' },
      { name: 'Back', value: 'back' }
    ]
  }]);

  if (action === 'add') {
    const { name, value } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: 'Metric:',
        choices: ['Weekly Active Users', 'Signups', 'Paying Customers', 'MRR', 'Conversations', 'Demo Calls', 'Other']
      },
      { type: 'number', name: 'value', message: 'Value:' }
    ]);
    if (name && value !== undefined) {
      const metricName = name === 'Other' ?
        (await inquirer.prompt([{ type: 'input', name: 'custom', message: 'Metric name:' }])).custom
        : name;
      recordMetric(projectId, metricName, value);
      console.log(chalk.green('\n✓ Metric recorded'));
    }
  }

  await inquirer.prompt([{ type: 'input', name: 'continue', message: chalk.gray('Press Enter...'), prefix: '' }]);
}

async function manageLearnings(projectId: string): Promise<void> {
  clearScreen();
  console.log(chalk.bold.cyan('\n💡 LEARNINGS\n'));

  const learnings = getLearnings(projectId);

  if (learnings.length > 0) {
    learnings.forEach(l => {
      console.log(chalk.yellow(`\n[${l.category}]`) + ` ${l.content}`);
      if (l.source) console.log(chalk.gray(`   Source: ${l.source}`));
    });
  } else {
    console.log(chalk.gray('   No learnings recorded yet'));
  }

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What do you want to do?',
    choices: [
      { name: 'Add learning', value: 'add' },
      { name: 'Back', value: 'back' }
    ]
  }]);

  if (action === 'add') {
    const { category, content, source } = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: 'Category:',
        choices: ['User Feedback', 'Market Insight', 'Channel Performance', 'Product Idea', 'Competitor', 'Other']
      },
      { type: 'input', name: 'content', message: 'What did you learn?' },
      { type: 'input', name: 'source', message: 'Source (optional):' }
    ]);
    if (content) {
      addLearning(projectId, category, content, source);
      console.log(chalk.green('\n✓ Learning saved'));
    }
  }

  await inquirer.prompt([{ type: 'input', name: 'continue', message: chalk.gray('Press Enter...'), prefix: '' }]);
}

async function askAI(projectId: string): Promise<void> {
  clearScreen();
  console.log(chalk.bold.cyan('\n🤖 ASK YOUR TEAM\n'));
  console.log(chalk.gray('Get advice on your launch. Type "back" to return.\n'));

  const project = getProject(projectId) as { name: string; url: string; description: string };
  const milestones = getMilestones(projectId);
  const contacts = getContacts(projectId);
  const learnings = getLearnings(projectId);
  const metrics = getLatestMetrics(projectId);

  // Build context
  const context = `
Project: ${project.name}
URL: ${project.url}
Description: ${project.description}

Milestones: ${milestones.map(m => `${m.status}: ${m.title}`).join(', ')}

Outreach Stats:
- Total contacts: ${contacts.length}
- Contacted: ${contacts.filter(c => c.status !== 'not_contacted').length}
- Responded: ${contacts.filter(c => ['responded', 'interested', 'converted'].includes(c.status)).length}
- Converted: ${contacts.filter(c => c.status === 'converted').length}

Recent Learnings:
${learnings.slice(0, 5).map(l => `- [${l.category}] ${l.content}`).join('\n')}

Metrics:
${metrics.map(m => `- ${m.metric_name}: ${m.value}`).join('\n')}
`;

  const orchestrator = new OrchestratorAgent();

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
      const response = await orchestrator.chat(`Context about my MVP launch:\n${context}\n\nMy question: ${message}`);
      console.log(chalk.blue('Team:'), response.content, '\n');

      // Save conversation
      saveConversation(projectId, message, response.content.slice(0, 500));
    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }

    await prompt();
  };

  await prompt();
}

async function setupProject(): Promise<string> {
  clearScreen();
  console.log(chalk.bold.cyan('\n🚀 LAUNCH MANAGER SETUP\n'));
  console.log(chalk.gray('Let\'s set up your project.\n'));

  const { name, url, description } = await inquirer.prompt([
    { type: 'input', name: 'name', message: 'Project name:', default: 'LoanFlow' },
    { type: 'input', name: 'url', message: 'URL:', default: 'https://loanflow.pages.dev' },
    { type: 'input', name: 'description', message: 'One-line description:', default: 'Simple CRM for mortgage professionals' }
  ]);

  const projectId = createProject(name, url, description);

  // Add default milestones
  const defaultMilestones = [
    'Get first 5 beta users',
    'Collect feedback from beta users',
    'Get first paying customer',
    'Reach 10 paying customers',
    'Hit $500 MRR'
  ];

  for (const milestone of defaultMilestones) {
    addMilestone(projectId, milestone);
  }

  // Add initial learnings
  addLearning(projectId, 'Channel Performance', 'LinkedIn cold outreach not working - people ignore DMs', 'User feedback');
  addLearning(projectId, 'Market Insight', 'Facebook Groups are active for mortgage pros: Loan Officer Freedom, Mortgage Marketing Animals', 'Research');

  console.log(chalk.green('\n✓ Project created with default milestones!'));
  await inquirer.prompt([{ type: 'input', name: 'continue', message: chalk.gray('Press Enter to continue...'), prefix: '' }]);

  return projectId;
}

async function showDashboard(projectId: string, projectName: string): Promise<void> {
  clearScreen();
  printHeader(projectName);
  printDashboard(projectId);
  printMenu();

  const { action } = await inquirer.prompt([{
    type: 'input',
    name: 'action',
    message: chalk.gray('Select:'),
    prefix: ''
  }]);

  switch (action) {
    case '1': await manageMilestones(projectId); break;
    case '2': await manageOutreach(projectId); break;
    case '3': await manageMetrics(projectId); break;
    case '4': await manageLearnings(projectId); break;
    case '5': await askAI(projectId); break;
    case '6': break;
    case 'q':
    case 'Q':
      console.log(chalk.cyan('\nGood luck with your launch! 🚀\n'));
      process.exit(0);
  }

  await showDashboard(projectId, projectName);
}

async function main(): Promise<void> {
  let project = getActiveProject();

  if (!project) {
    const projectId = await setupProject();
    project = getProject(projectId) as typeof project;
  }

  await showDashboard(project!.id, project!.name);
}

main().catch(console.error);
