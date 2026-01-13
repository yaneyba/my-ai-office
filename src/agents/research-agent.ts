import { BaseAgent } from '../core/base-agent.js';
import { saveMemory, searchMemories } from '../memory/database.js';
import type { AgentConfig, Tool } from '../types/index.js';

const RESEARCH_AGENT_PROMPT = `You're my research assistant. I'm your boss. Find what I need fast.

RULES:
- Give me the answer, not a research report
- 2-3 sentences unless I ask for more
- No intros like "Based on my research..."
- Just state what you found
- If you need to clarify scope, ask ONE question

You can fetch URLs, search past findings, and save important stuff.`;

const createTools = (): Tool[] => [
  {
    name: 'fetch_url',
    description: 'Fetch and extract content from a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' }
      },
      required: ['url']
    },
    execute: async (input: Record<string, unknown>) => {
      try {
        const response = await fetch(input.url as string, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ResearchAgent/1.0)'
          }
        });
        const html = await response.text();
        // Basic HTML to text conversion
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 10000);
        return text;
      } catch (error) {
        return `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  },
  {
    name: 'search_knowledge',
    description: 'Search previously saved research and facts',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      },
      required: ['query']
    },
    execute: async (input: Record<string, unknown>) => {
      const memories = searchMemories(input.query as string, 10);
      if (memories.length === 0) return 'No relevant past research found.';
      return memories.map(m => `[${m.type}] ${m.content}`).join('\n\n');
    }
  },
  {
    name: 'save_finding',
    description: 'Save an important research finding for future reference',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The finding to save' },
        topic: { type: 'string', description: 'Topic or category' },
        source: { type: 'string', description: 'Source URL or reference (optional)' }
      },
      required: ['content', 'topic']
    },
    execute: async (input: Record<string, unknown>) => {
      saveMemory({
        type: 'fact',
        content: input.content as string,
        metadata: {
          topic: input.topic,
          source: input.source
        },
        agentRole: 'research'
      });
      return `Finding saved under topic: ${input.topic}`;
    }
  }
];

export class ResearchAgent extends BaseAgent {
  constructor(sessionId?: string) {
    const config: AgentConfig = {
      name: 'Research',
      role: 'research',
      description: 'Expert at finding, synthesizing, and explaining information',
      systemPrompt: RESEARCH_AGENT_PROMPT,
      model: 'claude-sonnet-4-20250514',
      tools: createTools()
    };
    super(config, sessionId);
  }
}

export default ResearchAgent;
