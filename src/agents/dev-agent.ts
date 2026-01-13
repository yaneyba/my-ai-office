import { BaseAgent } from '../core/base-agent.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, readdir } from 'fs/promises';
import type { AgentConfig, Tool } from '../types/index.js';

const execAsync = promisify(exec);

const DEV_AGENT_PROMPT = `You are the Dev Agent - a skilled software development partner.

Your responsibilities:
1. Help with coding tasks across any language or framework
2. Debug issues and explain error messages
3. Suggest architecture improvements
4. Review code for bugs, security issues, and best practices
5. Help with testing strategies and implementation
6. Assist with git operations and deployments

You have access to tools for:
- Running shell commands
- Reading and writing files
- Searching codebases

Be thorough but concise. Explain your reasoning when making suggestions.
When you learn something about the user's coding preferences, include [REMEMBER:preference|description].`;

const createTools = (): Tool[] => [
  {
    name: 'run_command',
    description: 'Execute a shell command and return the output',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to run' },
        cwd: { type: 'string', description: 'Working directory (optional)' }
      },
      required: ['command']
    },
    execute: async (input: Record<string, unknown>) => {
      try {
        const { stdout, stderr } = await execAsync(input.command as string, {
          cwd: input.cwd as string | undefined,
          timeout: 30000
        });
        return stdout || stderr || 'Command completed successfully';
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file' }
      },
      required: ['path']
    },
    execute: async (input: Record<string, unknown>) => {
      try {
        const content = await readFile(input.path as string, 'utf-8');
        return content;
      } catch (error) {
        return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['path', 'content']
    },
    execute: async (input: Record<string, unknown>) => {
      try {
        await writeFile(input.path as string, input.content as string, 'utf-8');
        return `File written successfully: ${input.path}`;
      } catch (error) {
        return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  },
  {
    name: 'list_directory',
    description: 'List files and directories in a path',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' }
      },
      required: ['path']
    },
    execute: async (input: Record<string, unknown>) => {
      try {
        const entries = await readdir(input.path as string, { withFileTypes: true });
        return entries.map(e => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`).join('\n');
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  },
  {
    name: 'search_code',
    description: 'Search for a pattern in files using grep',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Search pattern (regex)' },
        path: { type: 'string', description: 'Directory to search in' },
        fileType: { type: 'string', description: 'File extension to filter (e.g., "ts", "py")' }
      },
      required: ['pattern', 'path']
    },
    execute: async (input: Record<string, unknown>) => {
      try {
        const typeFlag = input.fileType ? `--include="*.${input.fileType}"` : '';
        const { stdout } = await execAsync(
          `grep -rn ${typeFlag} "${input.pattern}" "${input.path}" 2>/dev/null | head -50`,
          { timeout: 10000 }
        );
        return stdout || 'No matches found';
      } catch {
        return 'No matches found';
      }
    }
  }
];

export class DevAgent extends BaseAgent {
  constructor(sessionId?: string) {
    const config: AgentConfig = {
      name: 'Dev',
      role: 'dev',
      description: 'Software development partner for coding, debugging, and architecture',
      systemPrompt: DEV_AGENT_PROMPT,
      model: 'claude-sonnet-4-20250514',
      tools: createTools()
    };
    super(config, sessionId);
  }
}

export default DevAgent;
