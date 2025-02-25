import { z } from 'zod';
import type { Message } from './message';
import type { Action } from './action';
import { createMachine } from 'xstate';

export const RoleContextSchema = z.object({
  memory: z.any(), // TODO: Define Memory type
  workingMemory: z.any(), // TODO: Define Memory type
  state: z.number(),
  todo: z.any().nullable(), // TODO: Define Action type
  watch: z.set(z.string()),
  reactMode: z.enum(['react', 'by_order', 'plan_and_act']),
});

export type RoleContext = z.infer<typeof RoleContextSchema>;

export const RoleSchema = z.object({
  name: z.string(),
  profile: z.string(),
  goal: z.string(),
  constraints: z.string(),
  actions: z.array(z.any()), // TODO: Define Action type
});

export type Role = z.infer<typeof RoleSchema> & {
  observe(): Promise<number>;
  think(): Promise<boolean>;
  act(): Promise<Message>;
  react(): Promise<Message>;
  state: number;
  context: RoleContext;
};

// 角色状态机定义
export const roleStateMachine = createMachine({
  id: 'role',
  initial: 'idle',
  states: {
    idle: {
      on: { OBSERVE: 'observing' }
    },
    observing: {
      on: { 
        THINK: 'thinking',
        COMPLETE: 'idle'
      }
    },
    thinking: {
      on: { 
        ACT: 'acting',
        COMPLETE: 'idle'
      }
    },
    acting: {
      on: { 
        REACT: 'reacting',
        COMPLETE: 'idle'
      }
    },
    reacting: {
      on: { 
        OBSERVE: 'observing',
        COMPLETE: 'idle'
      }
    }
  }
}); 