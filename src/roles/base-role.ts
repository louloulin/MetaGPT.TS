import { 
  createActor,
  type ActorLogic,
  type AnyActorRef,
  type ActorOptions,
  type StateMachine,
  fromPromise,
  setup,
  assign
} from 'xstate';
import type { 
  ActorRefFrom,
  AnyEventObject,
  SnapshotFrom
} from 'xstate';
import { Subject, Observable, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import type { 
  Role, 
  RoleContext, 
  RoleEvent,
  RoleMachine,
  RoleState,
  RoleReactMode
} from '../types/role';
import { 
  createRoleStateMachine,
  createDefaultRoleContext
} from '../types/role';
import type { Message } from '../types/message';
import type { Action, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';
import { generateId } from '../utils/common';
import { MemoryManagerImpl } from '../memory/manager';

/**
 * Enhanced Role Base Class
 * Uses XState for event-based state management and behavior dispatch
 */
export abstract class BaseRole implements Role {
  name: string;
  profile: string;
  goal: string;
  constraints: string;
  actions: Action[] = [];
  context: RoleContext;
  desc: string = '';
  states: string[] = [];

  // Message stream
  private messageSubject = new Subject<Message>();
  private messageObservable: Observable<Message> = this.messageSubject.asObservable();

  // State machine
  private machine: RoleMachine = createRoleStateMachine(createDefaultRoleContext());
  private actor!: ActorRefFrom<RoleMachine>;

  constructor(
    name: string,
    profile: string,
    goal: string,
    constraints: string = '',
    actions: Action[] = [],
    desc: string = ''
  ) {
    this.name = name;
    this.profile = profile;
    this.goal = goal;
    this.constraints = constraints;
    this.desc = desc;

    // Initialize context with memory manager
    this.context = createDefaultRoleContext();
    this.context.memory = new MemoryManagerImpl();
    
    // Initialize actions
    this.actions = [];
    actions.forEach(action => this.addAction(action));
    
    // Create state machine with updated context
    this.machine = createRoleStateMachine(this.context);

    // Initialize state machine
    this.initStateMachine();

    // Update message stream subscription
    this.messageObservable = this.messageSubject.asObservable();
    this.messageObservable.subscribe((message) => {
      this.addToMemory(message);
      logger.debug(`[${this.name}] Received message: ${message.content.substring(0, 50)}...`);
    });

    // Initialize memory
    this.initMemory().catch(error => {
      logger.error(`[${this.name}] Failed to initialize memory:`, error);
    });
  }

  /**
   * Add an action to the role
   * @param action Action to add
   */
  protected addAction(action: Action): void {
    this.actions.push(action);
  }

  /**
   * Initialize memory system
   */
  private async initMemory(): Promise<void> {
    if (this.context.memory) {
      await this.context.memory.init();
      // Initialize working memory as a reference to the same memory manager
      this.context.workingMemory = this.context.memory;
    }
  }

  /**
   * Initialize state machine
   */
  private initStateMachine(): void {
    // Create actor with options
    const options: ActorOptions<typeof this.machine> = {
      input: this.context,
      id: `role-${this.name}`,
      systemId: `role-${this.name}`
    };

    // Create and start actor
    this.actor = createActor(this.machine, options).start();

    // Subscribe to state changes
    this.actor.subscribe((snapshot: SnapshotFrom<RoleMachine>) => {
      const stateValue = snapshot.value as RoleState;
      logger.debug(`[${this.name}] State changed: ${stateValue}`);
      
      // Trigger state change hook
      this.onStateChanged(stateValue);

      // Handle state-specific logic
      if (stateValue === 'observing') {
        this.observe().then(hasMessages => {
          if (hasMessages) {
            this.sendEvent({ type: 'THINK' });
          } else {
            this.sendEvent({ type: 'COMPLETE' });
          }
        });
      } else if (stateValue === 'thinking') {
        this.think().then(canAct => {
          if (canAct) {
            this.sendEvent({ type: 'ACT' });
          } else {
            this.sendEvent({ type: 'COMPLETE' });
          }
        });
      } else if (stateValue === 'acting') {
        this.act().then(() => {
          this.sendEvent({ type: 'REACT' });
        });
      } else if (stateValue === 'reacting') {
        this.react().then(() => {
          this.sendEvent({ type: 'OBSERVE' });
        });
      }
    });
  }

  /**
   * Hook called when state changes
   * @param stateValue Current state value
   */
  protected onStateChanged(stateValue: RoleState): void {
    // Override in subclasses if needed
  }

  /**
   * Observe environment for messages
   * @returns True if messages were observed
   */
  async observe(): Promise<boolean> {
    logger.debug(`[${this.name}] Observing...`);
    
    // Check if there are any messages in memory
    const workingMemories = await this.context.memory.working.search({});
    const hasMessages = workingMemories.length > 0;
    
    return hasMessages;
  }

  /**
   * Think about what to do next
   * @returns True if thinking was successful
   */
  async think(): Promise<boolean> {
    logger.debug(`[${this.name}] Thinking...`);
    
    // Decide next action
    const nextAction = await this.decideNextAction();
    
    // Set the next action as todo
    this.setTodo(nextAction);
    
    return nextAction !== null;
  }

  /**
   * Execute the current todo action
   * @returns Message with action result
   */
  async act(): Promise<Message> {
    logger.debug(`[${this.name}] Acting...`);
    
    if (!this.context.todo) {
      return this.createMessage("No action to perform");
    }
    
    try {
      // Execute the action
      const action = this.context.todo;
      const result = await action.run();
      
      // Create message from result
      const message = this.createMessage(result.content);
      
      // Add to working memory
      await this.addToWorkingMemory(message);
      
      return message;
    } catch (error) {
      logger.error(`[${this.name}] Action error:`, error);
      return this.createMessage(`Error executing action: ${error}`);
    }
  }

  /**
   * React to a message by observing, thinking, and acting
   * @param message Optional message to react to
   * @returns Message with reaction result
   */
  async react(message?: Message): Promise<Message> {
    logger.debug(`[${this.name}] Reacting...`);
    
    // If message is provided, add it to memory
    if (message) {
      await this.addToMemory(message);
    }
    
    // Observe
    await this.observe();
    
    // Think
    const canAct = await this.think();
    
    if (!canAct) {
      return this.createMessage("Cannot determine next action");
    }
    
    // Act
    return await this.act();
  }

  /**
   * Main entry point for role execution
   * @param message Optional message to start with
   * @returns Result message from execution
   */
  async run(message?: Message): Promise<Message> {
    logger.info(`[${this.name}] Running role...`);
    
    // If message is provided, add it to memory
    if (message) {
      await this.addToMemory(message);
    }
    
    // Start the role's state machine if not already started
    if (this.actor.getSnapshot().status !== 'active') {
      this.start();
    }
    
    // Based on react mode, execute different patterns
    switch (this.context.reactMode) {
      case 'react':
        // Simple react pattern
        return await this.react(message);
        
      case 'by_order':
        // Execute actions in order
        await this.observe();
        await this.think();
        return await this.act();
        
      case 'plan_and_act':
        // Plan and execute actions
        await this.observe();
        await this.planActions(message);
        return await this.act();
        
      default:
        return await this.react(message);
    }
  }

  /**
   * Plan a sequence of actions
   * @param message Optional message to plan from
   */
  protected async planActions(message?: Message): Promise<void> {
    // Default implementation - override in subclasses
    await this.think();
  }

  /**
   * Decide the next action to take
   * @param message Optional message to consider
   * @returns Next action or null if no action can be determined
   */
  protected async decideNextAction(message?: Message): Promise<Action | null> {
    // Default implementation - override in subclasses
    // Return the first action if available
    return this.actions.length > 0 ? this.actions[0] : null;
  }

  /**
   * Get the current state
   * @returns Current state value
   */
  getState(): RoleState {
    return this.actor.getSnapshot().value as RoleState;
  }

  /**
   * Send an event to the state machine
   * @param event Event to send
   */
  sendEvent(event: RoleEvent): void {
    this.actor.send(event);
  }

  /**
   * Set the current todo action
   * @param action Action to set as todo
   */
  protected setTodo(action: Action | null): void {
    this.context.todo = action;
  }

  /**
   * Add message to memory
   */
  protected async addToMemory(message: Message): Promise<void> {
    if (this.context.memory) {
      await this.context.memory.processMessage(message);
    }
  }

  /**
   * Add message to working memory
   */
  protected async addToWorkingMemory(message: Message): Promise<void> {
    if (this.context.workingMemory) {
      await this.context.workingMemory.working.add(message.content, 'message', {
        role: message.role,
        causedBy: message.causedBy,
        sentFrom: message.sentFrom,
        sendTo: Array.from(message.sendTo),
        instructContent: message.instructContent,
        timestamp: Date.now(),
      });
    } else {
      logger.error(`[${this.name}] Working memory not initialized`);
    }
  }

  /**
   * Send a message to the message stream
   * @param message Message to send
   */
  protected sendMessage(message: Message): void {
    this.messageSubject.next(message);
  }

  /**
   * Subscribe to all messages
   * @returns Observable of messages
   */
  public subscribeToMessages(): Observable<Message> {
    return this.messageObservable;
  }

  /**
   * Filter messages by role
   * @param role Role to filter by
   * @returns Observable of filtered messages
   */
  public filterMessagesByRole(role: string): Observable<Message> {
    return this.messageObservable.pipe(
      filter(message => message.role === role)
    );
  }

  /**
   * Start the role's state machine
   */
  public start(): void {
    if (this.actor.getSnapshot().status !== 'active') {
      this.actor.start();
    }
    this.sendEvent({ type: 'OBSERVE' });
  }

  /**
   * Stop the role's state machine
   */
  public stop(): void {
    if (this.actor.getSnapshot().status === 'active') {
      this.actor.stop();
    }
  }

  /**
   * Reset the role's state
   */
  public reset(): void {
    // Reset context
    this.context.state = -1;
    this.context.todo = null;
    
    // Reset memory systems
    this.context.memory.init();
  }

  /**
   * Create a new message
   * @param content Message content
   * @returns Created message
   */
  protected createMessage(content: string): Message {
    return {
      id: generateId(),
      role: this.name,
      content,
      timestamp: new Date().toISOString(),
      causedBy: this.context.todo?.name || 'system',
      sentFrom: this.name,
      sendTo: new Set(['*']),
      instructContent: null
    };
  }

  /**
   * Set the react mode
   * @param mode React mode to set
   * @param maxReactLoop Maximum number of react loops
   */
  public setReactMode(mode: RoleReactMode, maxReactLoop: number = 1): void {
    this.context.reactMode = mode;
    this.context.maxReactLoop = maxReactLoop;
  }

  /**
   * Check if the role is idle
   * @returns True if the role is idle
   */
  public get isIdle(): boolean {
    return this.getState() === 'idle';
  }

  /**
   * Get the role's description
   * @returns Role description
   */
  public getDescription(): string {
    return `${this.name} (${this.profile}): ${this.goal}`;
  }

  /**
   * Get the role's action descriptions
   * @returns Action descriptions
   */
  public getActionDescriptions(): string[] {
    return this.actions.map(action => `${action.name}`);
  }
} 