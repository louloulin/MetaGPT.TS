/**
 * Teacher Role
 * 
 * This role specializes in educational content creation, explanation, and assessment.
 * It can create lessons, explain concepts, assess understanding, and provide
 * personalized feedback to help students learn effectively.
 */

import { BaseRole } from './base-role';
import type { Message } from '../types/message';
import type { LLMProvider } from '../types/llm';
import type { Action } from '../types/action';
import { logger } from '../utils/logger';
import type { RoleReactMode } from '../types/role';
import type { ActionOutput } from '../types/action';
import { 
  CreateLesson,
  ExplainConcept,
  AssessUnderstanding,
  ProvideFeedback
} from '../actions';

/**
 * Configuration interface for the Teacher role
 */
export interface TeacherConfig {
  name?: string;
  profile?: string;
  goal?: string;
  constraints?: string;
  teachingStyle?: 'socratic' | 'direct' | 'interactive' | 'adaptive';
  subjectExpertise?: string[];
  difficultyLevels?: ('beginner' | 'intermediate' | 'advanced')[];
  react_mode?: RoleReactMode;
  max_react_loop?: number;
}

/**
 * Teacher role implementation
 */
export class Teacher extends BaseRole {
  private teachingStyle: string;
  private subjectExpertise: string[];
  private difficultyLevels: string[];
  protected llm: LLMProvider;

  constructor(name: string, llm: LLMProvider, config: TeacherConfig = {}) {
    const {
      profile = 'Educational Expert',
      goal = 'Provide effective education and guidance through clear explanations and personalized feedback',
      constraints = 'Maintain educational standards, adapt to student needs, and ensure clear communication',
      teachingStyle = 'adaptive',
      subjectExpertise = ['mathematics', 'physics'],
      difficultyLevels = ['beginner', 'intermediate'],
      react_mode = 'plan_and_act',
      max_react_loop = 3
    } = config;

    const actualName = config.name || name;

    super(actualName, profile, goal, constraints, [], 'Creates educational content, explains concepts, and provides personalized feedback');

    this.teachingStyle = teachingStyle;
    this.subjectExpertise = subjectExpertise;
    this.difficultyLevels = difficultyLevels;
    this.llm = llm;
    
    // Initialize role
    this.initialize();
    
    // Set react mode
    this.setReactMode(react_mode, max_react_loop);
  }

  /**
   * Initialize the Teacher role
   */
  protected initialize(): void {
    logger.info(`[${this.name}] Initializing role`);
    
    // Initialize actions using addActions instead of direct assignment
    this.addActions([
      new CreateLesson({ llm: this.llm }),
      new ExplainConcept({ llm: this.llm }),
      new AssessUnderstanding({ llm: this.llm }),
      new ProvideFeedback({ llm: this.llm })
    ]);
    
    logger.info(`[${this.name}] Initialization complete`);
  }

  /**
   * Create a lesson plan for a given topic
   */
  public async createLessonPlan(topic: string): Promise<ActionOutput> {
    if (!topic) {
      return {
        status: 'failed',
        content: 'Empty topic'
      };
    }

    const createLesson = this.actions.find(action => action instanceof CreateLesson) as CreateLesson;
    if (!createLesson) {
      return {
        status: 'failed',
        content: 'CreateLesson action not initialized'
      };
    }

    return await createLesson.run({ topic, style: this.teachingStyle });
  }

  /**
   * Generate quiz questions for a topic
   */
  public async generateQuiz(topic: string): Promise<ActionOutput> {
    if (!topic) {
      return {
        status: 'failed',
        content: 'Empty topic'
      };
    }

    const assessUnderstanding = this.actions.find(action => action instanceof AssessUnderstanding) as AssessUnderstanding;
    if (!assessUnderstanding) {
      return {
        status: 'failed',
        content: 'AssessUnderstanding action not initialized'
      };
    }

    return await assessUnderstanding.run({ topic });
  }

  /**
   * Evaluate a student's answer
   */
  public async evaluateAnswer(question: string, answer: string): Promise<ActionOutput> {
    if (!question || !answer) {
      return {
        status: 'failed',
        content: 'Missing question or answer'
      };
    }

    const provideFeedback = this.actions.find(action => action instanceof ProvideFeedback) as ProvideFeedback;
    if (!provideFeedback) {
      return {
        status: 'failed',
        content: 'ProvideFeedback action not initialized'
      };
    }

    return await provideFeedback.run({ question, answer });
  }

  /**
   * Think about the next action based on the current context and message
   */
  public async think(): Promise<boolean> {
    const messages = this.context.memory.get();
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage) {
      logger.debug(`[${this.name}] No messages in memory for thinking`);
      return false;
    }

    logger.debug(`[${this.name}] Thinking about message: ${lastMessage.content}`);

    // Analyze the message content to determine the appropriate action
    const content = lastMessage.content.toLowerCase();
    let selectedAction: Action | undefined;

    if (content.includes('explain') || content.includes('what is') || content.includes('how to')) {
      selectedAction = this.actions.find(action => action instanceof ExplainConcept);
    } else if (content.includes('quiz') || content.includes('test') || content.includes('assess')) {
      selectedAction = this.actions.find(action => action instanceof AssessUnderstanding);
    } else if (content.includes('feedback') || content.includes('evaluate')) {
      selectedAction = this.actions.find(action => action instanceof ProvideFeedback);
    } else {
      selectedAction = this.actions.find(action => action instanceof CreateLesson);
    }

    if (selectedAction) {
      this.setTodo(selectedAction);
      return true;
    }

    return false;
  }

  /**
   * Get the teacher's current teaching style
   */
  public getTeachingStyle(): string {
    return this.teachingStyle;
  }

  /**
   * Set the teacher's teaching style
   */
  public setTeachingStyle(style: 'socratic' | 'direct' | 'interactive' | 'adaptive'): void {
    this.teachingStyle = style;
    logger.info(`[${this.name}] Teaching style updated to: ${style}`);
  }

  /**
   * Get the teacher's subject expertise
   */
  public getSubjectExpertise(): string[] {
    return this.subjectExpertise;
  }

  /**
   * Add a subject to the teacher's expertise
   */
  public addSubjectExpertise(subject: string): void {
    if (!this.subjectExpertise.includes(subject)) {
      this.subjectExpertise.push(subject);
      logger.info(`[${this.name}] Added subject expertise: ${subject}`);
    }
  }

  /**
   * Get the current todo action
   */
  public getTodo(): Action | undefined {
    return this.context.todo;
  }

  /**
   * Check if the teacher can handle a specific difficulty level
   */
  public canHandleDifficultyLevel(level: string): boolean {
    return this.difficultyLevels.includes(level);
  }
} 