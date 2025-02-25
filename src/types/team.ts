import { z } from 'zod';
import { Role } from './role';
import { Environment } from '../environment/environment';
import { Context } from '../context/context';
import { Message } from './message';

/**
 * Team configuration schema
 */
export const TeamConfigSchema = z.object({
  /** Environment for team communication and state management */
  environment: z.instanceof(Environment).optional(),
  /** Initial investment amount */
  investment: z.number().default(10.0),
  /** Project idea or requirement */
  idea: z.string().default(''),
  /** Team context */
  context: z.instanceof(Context).optional(),
  /** Team roles */
  roles: z.array(z.instanceof(Role)).optional(),
  /** Environment description */
  envDesc: z.string().optional(),
});

export type TeamConfig = z.infer<typeof TeamConfigSchema>;

/**
 * Team state schema
 */
export const TeamStateSchema = z.object({
  /** Current round number */
  currentRound: z.number().default(0),
  /** Whether team is running */
  isRunning: z.boolean().default(false),
  /** Whether team is archived */
  isArchived: z.boolean().default(false),
  /** Team history */
  history: z.array(z.instanceof(Message)).default([]),
});

export type TeamState = z.infer<typeof TeamStateSchema>;

/**
 * Team storage schema for serialization
 */
export const TeamStorageSchema = z.object({
  /** Team configuration */
  config: TeamConfigSchema,
  /** Team state */
  state: TeamStateSchema,
  /** Storage path */
  storagePath: z.string().optional(),
});

export type TeamStorage = z.infer<typeof TeamStorageSchema>; 