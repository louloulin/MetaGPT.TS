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

/**
 * Configuration interface for the Teacher role
 */
export interface TeacherConfig {
  llm: LLMProvider;
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
  private llm: LLMProvider;
  private teachingStyle: string;
  private subjectExpertise: string[];
  private difficultyLevels: string[];

  constructor(config: TeacherConfig) {
    const {
      llm,
      name = 'Teacher',
      profile = 'Educational Expert',
      goal = 'Provide effective education and guidance through clear explanations and personalized feedback',
      constraints = 'Maintain educational standards, adapt to student needs, and ensure clear communication',
      teachingStyle = 'adaptive',
      subjectExpertise = ['general'],
      difficultyLevels = ['beginner', 'intermediate', 'advanced'],
      react_mode = 'plan_and_act',
      max_react_loop = 3
    } = config;

    super(name, profile, goal, constraints);

    this.llm = llm;
    this.teachingStyle = teachingStyle;
    this.subjectExpertise = subjectExpertise;
    this.difficultyLevels = difficultyLevels;

    this.desc = 'Creates educational content, explains concepts, and provides personalized feedback';
    
    // Initialize role
    this.initialize();
    
    // Set react mode
    this.setReactMode(react_mode, max_react_loop);
  }

  /**
   * Initialize the Teacher role
   */
  private initialize(): void {
    logger.info('[Teacher] Initializing role');
    
    // Initialize actions (to be implemented)
    // this.actions = [
    //   new CreateLesson({ llm: this.llm }),
    //   new ExplainConcept({ llm: this.llm }),
    //   new AssessUnderstanding({ llm: this.llm }),
    //   new ProvideFeedback({ llm: this.llm })
    // ];
    
    logger.info('[Teacher] Initialization complete');
  }

  /**
   * Think about the next action based on the current context and message
   */
  public async think(): Promise<boolean> {
    const messages = this.context.memory.get();
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage) {
      logger.debug('[Teacher] No messages in memory for thinking');
      return false;
    }

    logger.debug(`[Teacher] Thinking about message: ${lastMessage.content}`);

    // TODO: Implement logic to:
    // 1. Analyze student's message/question
    // 2. Determine appropriate teaching approach
    // 3. Select relevant action based on context
    // 4. Consider previous interactions and progress

    // For now, return true to indicate thinking was performed
    return true;
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
    logger.info(`[Teacher] Teaching style updated to: ${style}`);
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
      logger.info(`[Teacher] Added subject expertise: ${subject}`);
    }
  }

  /**
   * Check if the teacher can handle a specific difficulty level
   */
  public canHandleDifficultyLevel(level: string): boolean {
    return this.difficultyLevels.includes(level);
  }
} 