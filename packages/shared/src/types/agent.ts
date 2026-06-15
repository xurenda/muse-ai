import { z } from "zod";

export const agentDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  personaId: z.string().min(1),
  skillIds: z.array(z.string().min(1)),
  description: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AgentDefinition = z.infer<typeof agentDefinitionSchema>;

export const personaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  systemPromptPath: z.string().min(1),
});

export type Persona = z.infer<typeof personaSchema>;
