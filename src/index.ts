// My Team - Personal AI Agent System
export { BaseAgent } from './core/base-agent.js';
export { OrchestratorAgent } from './agents/orchestrator.js';
export { DevAgent } from './agents/dev-agent.js';
export { ResearchAgent } from './agents/research-agent.js';
export { CommsAgent } from './agents/comms-agent.js';
export { WorkflowAgent } from './agents/workflow-agent.js';
export * from './types/index.js';
export * from './memory/database.js';

// Default: launch the Office
import './office.js';
