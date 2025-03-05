import { z } from 'zod';
import type { Message } from './message';
import type { Action } from './action';
import { createMachine } from 'xstate';

export const RoleReactModeEnum = z.enum(['react', 'by_order', 'plan_and_act']);
export type RoleReactMode = z.infer<typeof RoleReactModeEnum>;

export const RoleContextSchema = z.object({
  memory: z.any(), // TODO: Define Memory type
  workingMemory: z.any(), // TODO: Define Memory type
  state: z.number(),
  todo: z.any().nullable(), // TODO: Define Action type
  watch: z.set(z.string()),
  reactMode: RoleReactModeEnum,
  maxReactLoop: z.number().default(1),
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
  observe(): Promise<boolean>;
  think(): Promise<boolean>;
  act(): Promise<Message>;
  react(message?: Message): Promise<Message>;
  run(message?: Message): Promise<Message>;
  context: RoleContext;
};

// Role state type
export type RoleState = 'idle' | 'observing' | 'thinking' | 'acting' | 'reacting';

// Role event type
export type RoleEvent = 
  | { type: 'OBSERVE' }
  | { type: 'THINK' }
  | { type: 'ACT' }
  | { type: 'REACT', message?: Message }
  | { type: 'COMPLETE' }
  | { type: 'ERROR', error: Error };

// Role state machine type
export type RoleMachine = ReturnType<typeof createRoleStateMachine>;

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

/**
 * Create default role context
 */
export function createDefaultRoleContext(): RoleContext {
  return {
    memory: {
      add: (message: Message) => {},
      get: () => [],
      getMessages: () => [],
      clear: () => {}
    },
    workingMemory: {
      add: (message: Message) => {},
      get: () => [],
      getMessages: () => [],
      clear: () => {}
    },
    state: -1,
    todo: null,
    watch: new Set<string>(),
    reactMode: 'react',
    maxReactLoop: 1
  };
}

/**
 * Create role state machine
 */
export function createRoleStateMachine(context: RoleContext) {
  return createMachine({
    id: 'role',
    initial: 'idle',
    context,
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
} 