/**
 * 状态机核心功能测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { StateMachine } from '../state-machine';
import { 
  createStateId, 
  createEventType,
  type StateMachineConfig,
  type StateSnapshot,
} from '../types';

// 测试用的简单上下文
interface TestContext {
  counter: number;
  data: string;
  error?: Error;
}

// 测试用的状态机配置
function createTestStateMachineConfig(): StateMachineConfig<TestContext> {
  return {
    id: 'test-machine',
    initial: createStateId('idle'),
    context: {
      counter: 0,
      data: 'initial',
    },
    states: {
      [createStateId('idle')]: {
        id: createStateId('idle'),
        name: 'Idle',
        description: '空闲状态',
        onEntry: async (ctx) => {
          ctx.data = 'entered-idle';
        },
        onExit: async (ctx) => {
          ctx.data = 'exited-idle';
        },
        transitions: {
          [createEventType('START')]: {
            target: createStateId('running'),
            description: '开始运行',
          },
          [createEventType('ERROR')]: {
            target: createStateId('error'),
            description: '进入错误状态',
          },
        },
      },
      [createStateId('running')]: {
        id: createStateId('running'),
        name: 'Running',
        description: '运行状态',
        onEntry: async (ctx) => {
          ctx.counter++;
          ctx.data = 'running';
        },
        transitions: {
          [createEventType('COMPLETE')]: {
            target: createStateId('completed'),
            guard: async (ctx) => ctx.counter >= 5,
            description: '完成（需要计数器>=5）',
          },
          [createEventType('CONTINUE')]: {
            target: createStateId('running'),
            effect: async (ctx) => {
              ctx.counter++;
            },
            description: '继续运行',
          },
          [createEventType('STOP')]: {
            target: createStateId('idle'),
            description: '停止运行',
          },
          [createEventType('ERROR')]: {
            target: createStateId('error'),
            description: '进入错误状态',
          },
        },
      },
      [createStateId('completed')]: {
        id: createStateId('completed'),
        name: 'Completed',
        description: '完成状态',
        onEntry: async (ctx) => {
          ctx.data = 'completed';
        },
        transitions: {
          [createEventType('RESET')]: {
            target: createStateId('idle'),
            effect: async (ctx) => {
              ctx.counter = 0;
              ctx.data = 'reset';
            },
            description: '重置',
          },
        },
        final: true,
      },
      [createStateId('error')]: {
        id: createStateId('error'),
        name: 'Error',
        description: '错误状态',
        onEntry: async (ctx, event) => {
          ctx.data = 'error';
          if (event.data?.error) {
            ctx.error = event.data.error;
          }
        },
        transitions: {
          [createEventType('RETRY')]: {
            target: createStateId('idle'),
            effect: async (ctx) => {
              ctx.error = undefined;
            },
            description: '重试',
          },
        },
      },
    },
  };
}

describe('StateMachine 核心功能测试', () => {
  let stateMachine: StateMachine<TestContext>;
  let config: StateMachineConfig<TestContext>;

  beforeEach(() => {
    config = createTestStateMachineConfig();
    stateMachine = new StateMachine(config, { debug: true });
  });

  afterEach(async () => {
    if (stateMachine) {
      await stateMachine.stop();
    }
  });

  describe('基础功能', () => {
    it('应该正确初始化状态机', () => {
      expect(stateMachine.getId()).toBe('test-machine');
      expect(stateMachine.getCurrentState()).toBe(createStateId('idle'));
      
      const context = stateMachine.getContext();
      expect(context.counter).toBe(0);
      expect(context.data).toBe('initial');
    });

    it('应该能够启动状态机', async () => {
      await stateMachine.start();
      
      const snapshot = stateMachine.getSnapshot();
      expect(snapshot.value).toBe(createStateId('idle'));
      
      const context = stateMachine.getContext();
      expect(context.data).toBe('entered-idle'); // onEntry 应该被调用
    });

    it('应该能够停止状态机', async () => {
      await stateMachine.start();
      await stateMachine.stop();
      
      const context = stateMachine.getContext();
      expect(context.data).toBe('exited-idle'); // onExit 应该被调用
    });
  });

  describe('状态转换', () => {
    beforeEach(async () => {
      await stateMachine.start();
    });

    it('应该能够执行基本状态转换', async () => {
      const success = await stateMachine.send({
        type: createEventType('START'),
        timestamp: Date.now(),
      });

      expect(success).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(createStateId('running'));
      
      const context = stateMachine.getContext();
      expect(context.counter).toBe(1); // onEntry 应该增加计数器
      expect(context.data).toBe('running');
    });

    it('应该能够处理转换守卫', async () => {
      // 先转换到 running 状态（计数器会变成1）
      await stateMachine.send({
        type: createEventType('START'),
        timestamp: Date.now(),
      });

      // 检查计数器确实是1
      expect(stateMachine.getContext().counter).toBe(1);

      // 尝试完成，但计数器不够（需要>=3）
      const success1 = await stateMachine.send({
        type: createEventType('COMPLETE'),
        timestamp: Date.now(),
      });

      expect(success1).toBe(false); // 守卫应该阻止转换
      expect(stateMachine.getCurrentState()).toBe(createStateId('running'));

      // 增加计数器到足够的值（需要再增加2次到达3）
      await stateMachine.send({
        type: createEventType('CONTINUE'),
        timestamp: Date.now(),
      });
      await stateMachine.send({
        type: createEventType('CONTINUE'),
        timestamp: Date.now(),
      });

      // 检查计数器现在是5 (1 + 2*2，每次CONTINUE都会执行副作用+onEntry)
      expect(stateMachine.getContext().counter).toBe(5);

      // 现在应该能够完成
      const success2 = await stateMachine.send({
        type: createEventType('COMPLETE'),
        timestamp: Date.now(),
      });

      expect(success2).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(createStateId('completed'));
    });

    it('应该能够执行转换副作用', async () => {
      await stateMachine.send({
        type: createEventType('START'),
        timestamp: Date.now(),
      });

      // 转换到running状态后，计数器应该是1（由onEntry增加）
      const initialCounter = stateMachine.getContext().counter;
      expect(initialCounter).toBe(1);

      await stateMachine.send({
        type: createEventType('CONTINUE'),
        timestamp: Date.now(),
      });

      const context = stateMachine.getContext();
      // CONTINUE事件的副作用会增加计数器，但由于是自转换，onEntry也会再次执行
      // 所以计数器会增加2（副作用+1，onEntry+1）
      expect(context.counter).toBe(initialCounter + 2);
    });

    it('应该能够处理无效事件', async () => {
      const success = await stateMachine.send({
        type: createEventType('INVALID_EVENT'),
        timestamp: Date.now(),
      });

      expect(success).toBe(false);
      expect(stateMachine.getCurrentState()).toBe(createStateId('idle')); // 状态不应该改变
    });
  });

  describe('状态历史', () => {
    beforeEach(async () => {
      await stateMachine.start();
    });

    it('应该记录状态转换历史', async () => {
      await stateMachine.send({
        type: createEventType('START'),
        timestamp: Date.now(),
      });

      await stateMachine.send({
        type: createEventType('STOP'),
        timestamp: Date.now(),
      });

      const snapshot = stateMachine.getSnapshot();
      expect(snapshot.history).toHaveLength(2);
      
      expect(snapshot.history[0].from).toBe(createStateId('idle'));
      expect(snapshot.history[0].to).toBe(createStateId('running'));
      expect(snapshot.history[0].event).toBe(createEventType('START'));
      
      expect(snapshot.history[1].from).toBe(createStateId('running'));
      expect(snapshot.history[1].to).toBe(createStateId('idle'));
      expect(snapshot.history[1].event).toBe(createEventType('STOP'));
    });

    it('应该记录转换耗时', async () => {
      await stateMachine.send({
        type: createEventType('START'),
        timestamp: Date.now(),
      });

      const snapshot = stateMachine.getSnapshot();
      const lastEntry = snapshot.history[snapshot.history.length - 1];
      
      expect(lastEntry.duration).toBeGreaterThanOrEqual(0);
      expect(typeof lastEntry.duration).toBe('number');
    });
  });

  describe('上下文管理', () => {
    beforeEach(async () => {
      await stateMachine.start();
    });

    it('应该能够更新上下文', () => {
      stateMachine.updateContext(ctx => ({
        ...ctx,
        data: 'updated',
        counter: 99,
      }));

      const context = stateMachine.getContext();
      expect(context.data).toBe('updated');
      expect(context.counter).toBe(99);
    });

    it('应该在上下文更新时发射事件', (done) => {
      stateMachine.on('state:changed', (snapshot) => {
        if (snapshot.context.data === 'updated-by-event') {
          done();
        }
      });

      stateMachine.updateContext(ctx => ({
        ...ctx,
        data: 'updated-by-event',
      }));
    });
  });

  describe('事件监听', () => {
    beforeEach(async () => {
      await stateMachine.start();
    });

    it('应该能够监听状态变化事件', (done) => {
      stateMachine.on('state:changed', (snapshot) => {
        if (snapshot.value === createStateId('running')) {
          expect(snapshot.context.data).toBe('running');
          done();
        }
      });

      stateMachine.send({
        type: createEventType('START'),
        timestamp: Date.now(),
      });
    });

    it('应该能够监听状态进入和退出事件', () => {
      let enteredState: string | null = null;
      let exitedState: string | null = null;

      stateMachine.on('state:entered', (stateId) => {
        enteredState = stateId;
      });

      stateMachine.on('state:exited', (stateId) => {
        exitedState = stateId;
      });

      return stateMachine.send({
        type: createEventType('START'),
        timestamp: Date.now(),
      }).then(() => {
        expect(exitedState).toBe(createStateId('idle'));
        expect(enteredState).toBe(createStateId('running'));
      });
    });

    it('应该能够监听转换事件', () => {
      let transitionStarted = false;
      let transitionCompleted = false;

      stateMachine.on('transition:started', () => {
        transitionStarted = true;
      });

      stateMachine.on('transition:completed', () => {
        transitionCompleted = true;
      });

      return stateMachine.send({
        type: createEventType('START'),
        timestamp: Date.now(),
      }).then(() => {
        expect(transitionStarted).toBe(true);
        expect(transitionCompleted).toBe(true);
      });
    });
  });

  describe('错误处理', () => {
    it('应该在配置无效时抛出错误', () => {
      const invalidConfig = {
        ...config,
        initial: createStateId('nonexistent'),
      };

      expect(() => new StateMachine(invalidConfig)).toThrow();
    });

    it('应该在转换目标状态不存在时抛出错误', () => {
      const invalidConfig = {
        ...config,
        states: {
          ...config.states,
          [createStateId('invalid')]: {
            id: createStateId('invalid'),
            name: 'Invalid',
            transitions: {
              [createEventType('GO')]: {
                target: createStateId('nonexistent'),
                description: 'Invalid transition',
              },
            },
          },
        },
      };

      expect(() => new StateMachine(invalidConfig)).toThrow();
    });
  });

  describe('工具方法', () => {
    beforeEach(async () => {
      await stateMachine.start();
    });

    it('应该能够检查可用的转换', () => {
      const canStart = stateMachine.canTransition(createEventType('START'));
      const canInvalid = stateMachine.canTransition(createEventType('INVALID'));

      expect(canStart).toBe(true);
      expect(canInvalid).toBe(false);
    });

    it('应该能够获取可用的转换事件', () => {
      const availableTransitions = stateMachine.getAvailableTransitions();
      
      expect(availableTransitions).toContain(createEventType('START'));
      expect(availableTransitions).toContain(createEventType('ERROR'));
      expect(availableTransitions).not.toContain(createEventType('COMPLETE'));
    });

    it('应该能够获取状态快照', () => {
      const snapshot = stateMachine.getSnapshot();
      
      expect(snapshot.value).toBe(createStateId('idle'));
      expect(snapshot.context).toBeDefined();
      expect(snapshot.history).toBeDefined();
      expect(snapshot.done).toBe(false);
      expect(snapshot.meta).toBeDefined();
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });
  });
});
