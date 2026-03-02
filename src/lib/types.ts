export type Protocol = "ws" | "wss";

export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: Protocol;
  path: string;
  username?: string;
  password?: string;
  traversalSource?: string;
}

export interface ServerFile {
  servers: ServerConfig[];
}

export interface SessionMessage {
  id: string;
  role: "user" | "assistant";
  prompt?: string;
  query?: string;
  reasoning?: string;
  data?: unknown;
  graph?: GraphPayload;
  createdAt: string;
  error?: string;
}

export interface SessionAgentContext {
  janusgraphRuntimeContext?: Record<string, unknown>;
  janusgraphContextUpdatedAt?: string;
  contextFiles?: {
    graphDataModelPath: string;
    janusgraphSchemaIndexesPath: string;
  };
}

export interface Session {
  id: string;
  serverId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
  agentContext?: SessionAgentContext;
}

export interface SessionsFile {
  sessions: Session[];
}

export interface GraphNode {
  id: string;
  label: string;
  data?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AgentRequest {
  serverId: string;
  sessionId: string;
  prompt: string;
}

export interface AgentResponse {
  query: string;
  reasoning: string;
  data: unknown;
  graph: GraphPayload;
  sessionMessageIds: {
    userMessageId: string;
    assistantMessageId: string;
  };
  latencyMs: number;
  error?: string;
}
