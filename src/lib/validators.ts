import { z } from "zod";

export const serverSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  protocol: z.enum(["ws", "wss"]),
  path: z.string().startsWith("/"),
  username: z.string().optional().default(""),
  password: z.string().optional().default(""),
  traversalSource: z.string().optional().default("g")
});

export const serverCreateSchema = serverSchema.omit({ id: true }).extend({
  id: z.string().optional()
});

export const sessionCreateSchema = z.object({
  serverId: z.string().min(1),
  title: z.string().min(1).max(120).optional()
});

export const sessionPatchSchema = z.object({
  title: z.string().min(1).max(120)
});

export const agentRequestSchema = z.object({
  serverId: z.string().min(1),
  sessionId: z.string().min(1),
  prompt: z.string().min(1).max(4000)
});

export const agentRerunSchema = z.object({
  serverId: z.string().min(1),
  sessionId: z.string().min(1),
  query: z.string().min(1).max(10000)
});
