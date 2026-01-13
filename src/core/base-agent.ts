import Anthropic from '@anthropic-ai/sdk';
import type { AgentConfig, AgentResponse, Message, Tool, AgentRole } from '../types/index.js';
import { saveMemory, getMemories, getAllPreferences, saveConversationMessage, getConversationHistory } from '../memory/database.js';

export abstract class BaseAgent {
  protected client: Anthropic;
  protected config: AgentConfig;
  protected sessionId: string;
  protected conversationHistory: Message[] = [];

  constructor(config: AgentConfig, sessionId?: string) {
    this.client = new Anthropic();
    this.config = config;
    this.sessionId = sessionId || `session-${Date.now()}`;
  }

  protected buildSystemPrompt(): string {
    const preferences = getAllPreferences();
    const recentMemories = getMemories(undefined, this.config.role, 20);

    let prompt = this.config.systemPrompt;

    if (preferences.length > 0) {
      prompt += '\n\n## User Preferences (learned over time)\n';
      const grouped = preferences.reduce((acc, p) => {
        acc[p.category] = acc[p.category] || [];
        acc[p.category].push(p);
        return acc;
      }, {} as Record<string, typeof preferences>);

      for (const [category, prefs] of Object.entries(grouped)) {
        prompt += `\n### ${category}\n`;
        for (const pref of prefs) {
          prompt += `- ${pref.key}: ${pref.value}\n`;
        }
      }
    }

    if (recentMemories.length > 0) {
      prompt += '\n\n## Recent Context\n';
      for (const mem of recentMemories.slice(0, 10)) {
        prompt += `- [${mem.type}] ${mem.content}\n`;
      }
    }

    return prompt;
  }

  protected async executeTools(toolCalls: Anthropic.ToolUseBlock[]): Promise<Anthropic.ToolResultBlockParam[]> {
    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const toolCall of toolCalls) {
      const tool = this.config.tools?.find(t => t.name === toolCall.name);
      if (tool) {
        try {
          const result = await tool.execute(toolCall.input as Record<string, unknown>);
          results.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: result
          });
        } catch (error) {
          results.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            is_error: true
          });
        }
      }
    }

    return results;
  }

  async chat(userMessage: string): Promise<AgentResponse> {
    // Save user message
    saveConversationMessage(this.sessionId, {
      role: 'user',
      content: userMessage
    });

    // Load conversation history
    const history = getConversationHistory(this.sessionId);
    const messages: Anthropic.MessageParam[] = history.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Add current message if not already in history
    if (messages.length === 0 || messages[messages.length - 1].content !== userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    // Build tools for API
    const tools: Anthropic.Tool[] = this.config.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool['input_schema']
    })) || [];

    // Call Claude
    let response = await this.client.messages.create({
      model: this.config.model || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: this.buildSystemPrompt(),
      messages,
      tools: tools.length > 0 ? tools : undefined
    });

    // Handle tool use loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults = await this.executeTools(toolUseBlocks);

      messages.push({
        role: 'assistant',
        content: response.content
      });
      messages.push({
        role: 'user',
        content: toolResults
      });

      response = await this.client.messages.create({
        model: this.config.model || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: this.buildSystemPrompt(),
        messages,
        tools: tools.length > 0 ? tools : undefined
      });
    }

    // Extract text response
    const textContent = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    const responseText = textContent?.text || '';

    // Save assistant response
    saveConversationMessage(this.sessionId, {
      role: 'assistant',
      content: responseText,
      agentRole: this.config.role
    });

    // Extract any delegation or memory instructions from response
    const agentResponse = this.parseResponse(responseText);

    // Store any memories
    if (agentResponse.memoriesToStore) {
      for (const memory of agentResponse.memoriesToStore) {
        saveMemory(memory);
      }
    }

    return agentResponse;
  }

  protected parseResponse(text: string): AgentResponse {
    // Look for special markers in the response
    const delegateMatch = text.match(/\[DELEGATE:(\w+)\]/);
    const memoryMatches = [...text.matchAll(/\[REMEMBER:(\w+)\|(.*?)\]/g)];

    const memoriesToStore = memoryMatches.map(match => ({
      type: match[1] as 'preference' | 'fact' | 'task',
      content: match[2],
      metadata: {},
      agentRole: this.config.role
    }));

    // Clean response text
    let cleanText = text
      .replace(/\[DELEGATE:\w+\]/g, '')
      .replace(/\[REMEMBER:\w+\|.*?\]/g, '')
      .trim();

    return {
      content: cleanText,
      delegateTo: delegateMatch ? delegateMatch[1] as AgentRole : undefined,
      memoriesToStore: memoriesToStore.length > 0 ? memoriesToStore : undefined
    };
  }

  getRole(): AgentRole {
    return this.config.role;
  }

  getName(): string {
    return this.config.name;
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
