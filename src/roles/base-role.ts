import { interpret, createActor } from 'xstate';
import { Subject } from 'rxjs';
import type { Role, RoleContext } from '../types/role';
import type { Message } from '../types/message';
import type { Action } from '../types/action';
import { roleStateMachine } from '../types/role';
import { ArrayMemory } from '../types/memory';
import { generateId } from '../utils/common';

/**
 * 角色基类
 * 实现了基本的角色行为和状态管理
 */
export abstract class BaseRole implements Role {
  name: string;
  profile: string;
  goal: string;
  constraints: string;
  actions: Action[] = [];
  state = -1;
  context: RoleContext;

  // 消息流
  private messageSubject = new Subject<Message>();

  // 状态机
  private stateMachine = createActor(roleStateMachine).start();

  constructor(
    name: string,
    profile: string,
    goal: string,
    constraints: string = '',
    actions: Action[] = []
  ) {
    this.name = name;
    this.profile = profile;
    this.goal = goal;
    this.constraints = constraints;
    this.actions = actions;

    // 初始化上下文
    this.context = {
      memory: new ArrayMemory(),
      workingMemory: new ArrayMemory(),
      state: -1,
      todo: null,
      watch: new Set<string>(),
      reactMode: 'react',
    };

    // 订阅状态变化
    this.stateMachine.subscribe((state) => {
      this.state = this.stateToNumber(state.value as string);
    });

    // 订阅消息
    this.messageSubject.subscribe((message) => {
      this.context.memory.add(message);
    });
  }

  /**
   * 观察环境，获取下一个状态
   */
  async observe(): Promise<number> {
    this.stateMachine.send({ type: 'OBSERVE' });
    const messages = await this.context.memory.get();
    // 子类需要实现具体的观察逻辑
    return this.state;
  }

  /**
   * 思考下一步行动
   */
  async think(): Promise<boolean> {
    this.stateMachine.send({ type: 'THINK' });
    // 子类需要实现具体的思考逻辑
    return true;
  }

  /**
   * 执行行动
   */
  async act(): Promise<Message> {
    this.stateMachine.send({ type: 'ACT' });
    if (!this.context.todo) {
      throw new Error('No action to execute');
    }

    try {
      const output = await this.context.todo.run();
      const message: Message = {
        id: generateId(),
        content: output.content,
        role: this.name,
        causedBy: this.context.todo.name,
        sentFrom: this.name,
        sendTo: new Set(['*']),
        instructContent: output.instruct_content,
      };

      this.messageSubject.next(message);
      return message;
    } catch (error) {
      await this.context.todo.handleException(error as Error);
      throw error;
    }
  }

  /**
   * 角色对消息的响应
   */
  async react(message?: Message): Promise<Message> {
    console.log(`[BaseRole] react method called in ${this.name} with${message ? '' : 'out'} message`);
    this.stateMachine.send({ type: 'REACT' });
    // 子类需要实现具体的响应逻辑
    return this.act();
  }

  /**
   * 将状态字符串转换为数字
   */
  private stateToNumber(state: string): number {
    const stateMap: Record<string, number> = {
      idle: -1,
      observing: 0,
      thinking: 1,
      acting: 2,
      reacting: 3,
    };
    return stateMap[state] ?? -1;
  }

  /**
   * 设置要执行的动作
   */
  protected setTodo(action: Action | null): void {
    this.context.todo = action;
  }

  /**
   * 获取记忆中的重要消息
   */
  protected getImportantMemory(): Message[] {
    return this.context.memory.getByActions(this.context.watch);
  }

  /**
   * 发送消息
   */
  protected sendMessage(message: Message): void {
    this.messageSubject.next(message);
  }
} 