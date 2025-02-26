import { 
  createActor
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
  private messageObservable: Observable<Message>;

  // State machine
  private machine: RoleMachine;
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
    this.actions = actions;
    this.desc = desc;

    // Initialize context
    this.context = createDefaultRoleContext();
    
    // Create state machine
    this.machine = createRoleStateMachine(this.context);

    // Initialize state machine
    this.initStateMachine();

    // Initialize message stream
    this.messageObservable = this.messageSubject.asObservable();
    this.messageObservable.subscribe((message) => {
      this.context.memory.add(message);
      logger.debug(`[${this.name}] Received message: ${message.content.substring(0, 50)}...`);
    });
  }

  /**
   * Initialize state machine
   */
  private initStateMachine(): void {
    // Create state machine actor
    this.actor = createActor(this.machine, {
      input: this.context,
      systemId: `role-${this.name}`,
      // Service configuration
      services: this.createServices()
    }).start();

    // Subscribe to state changes
    this.actor.subscribe((snapshot: SnapshotFrom<RoleMachine>) => {
      const stateValue = snapshot.value as RoleState;
      logger.debug(`[${this.name}] State changed: ${stateValue}`);
      
      // Trigger state change hook
      this.onStateChanged(stateValue);
    });
  }

  /**
   * Create services
   */
  private createServices() {
    return {
      observeService: this.createService(async () => {
        return await this.observe();
      }),
      
      thinkService: this.createService(async () => {
        return await this.think();
      }),
      
      actService: this.createService(async () => {
        return await this.act();
      }),
      
      reactService: this.createService(async (input?: Message) => {
        return await this.react(input);
      })
    };
  }

  /**
   * Create a service function for the state machine
   */
  private createService<T, I = undefined>(fn: (input?: I) => Promise<T>) {
    return async ({ input }: { input?: I }) => {
      try {
        return await fn(input);
      } catch (error) {
        logger.error(`[${this.name}] Service error:`, error);
        throw error;
      }
    };
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
    const hasMessages = this.context.memory.getMessages().length > 0;
    
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
      this.addToWorkingMemory(message);
      
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
      this.addToMemory(message);
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
      this.addToMemory(message);
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
   * Add a message to memory
   * @param message Message to add
   */
  protected addToMemory(message: Message): void {
    this.context.memory.add(message);
  }

  /**
   * Add a message to working memory
   * @param message Message to add
   */
  protected addToWorkingMemory(message: Message): void {
    this.context.workingMemory.add(message);
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
    this.context.memory.clear();
    this.context.workingMemory.clear();
    
    // Restart state machine
    this.stop();
    this.start();
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