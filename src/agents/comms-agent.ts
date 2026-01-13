import { BaseAgent } from '../core/base-agent.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { AgentConfig, Tool } from '../types/index.js';

const COMMS_AGENT_PROMPT = `You're my comms assistant. I'm your boss. Write what I need.

RULES:
- Just write the draft, no preamble
- Match my tone (professional unless told otherwise)
- No "Here's a draft..." - just give me the text
- If you need recipient/context, ask ONE question

You can read docs, save drafts, use templates.`;

const createTools = (): Tool[] => [
  {
    name: 'read_document',
    description: 'Read an existing document',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the document' }
      },
      required: ['path']
    },
    execute: async (input: Record<string, unknown>) => {
      try {
        const content = await readFile(input.path as string, 'utf-8');
        return content;
      } catch (error) {
        return `Error reading document: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  },
  {
    name: 'save_draft',
    description: 'Save a draft document for review',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to save the draft' },
        content: { type: 'string', description: 'Draft content' }
      },
      required: ['path', 'content']
    },
    execute: async (input: Record<string, unknown>) => {
      try {
        const path = input.path as string;
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, input.content as string, 'utf-8');
        return `Draft saved to: ${path}`;
      } catch (error) {
        return `Error saving draft: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  },
  {
    name: 'get_template',
    description: 'Get a template for a common document type',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['email', 'report', 'meeting_notes', 'proposal', 'feedback'],
          description: 'Template type'
        }
      },
      required: ['type']
    },
    execute: async (input: Record<string, unknown>) => {
      const templates: Record<string, string> = {
        email: `Subject: [Clear, specific subject]

Hi [Name],

[Opening - context or greeting]

[Main message - what you need or want to share]

[Action items or next steps, if any]

[Closing]
[Your name]`,

        report: `# [Report Title]
Date: [Date]
Author: [Name]

## Executive Summary
[2-3 sentence overview]

## Key Findings
- Finding 1
- Finding 2
- Finding 3

## Details
[Detailed analysis]

## Recommendations
1. Recommendation 1
2. Recommendation 2

## Next Steps
- [ ] Action item 1
- [ ] Action item 2`,

        meeting_notes: `# Meeting Notes: [Topic]
Date: [Date]
Attendees: [Names]

## Agenda
1. Item 1
2. Item 2

## Discussion
### Topic 1
- Key point
- Decision made

## Action Items
| Owner | Task | Due Date |
|-------|------|----------|
| Name  | Task | Date     |

## Next Meeting
Date: [Date]
Topics: [Topics]`,

        proposal: `# [Proposal Title]

## Problem Statement
[What problem are we solving?]

## Proposed Solution
[High-level description]

## Benefits
- Benefit 1
- Benefit 2

## Approach
1. Phase 1
2. Phase 2

## Success Metrics
- Metric 1
- Metric 2

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Risk | Plan       |`,

        feedback: `## Feedback: [Topic/Person/Project]

### What's Working Well
- Positive point 1
- Positive point 2

### Areas for Improvement
- Constructive point 1
- Constructive point 2

### Specific Suggestions
1. Suggestion 1
2. Suggestion 2

### Overall Assessment
[Summary and encouragement]`
      };

      return templates[input.type as string] || 'Template not found';
    }
  }
];

export class CommsAgent extends BaseAgent {
  constructor(sessionId?: string) {
    const config: AgentConfig = {
      name: 'Comms',
      role: 'comms',
      description: 'Expert communicator for emails, docs, and presentations',
      systemPrompt: COMMS_AGENT_PROMPT,
      model: 'claude-sonnet-4-20250514',
      tools: createTools()
    };
    super(config, sessionId);
  }
}

export default CommsAgent;
