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
 * Stream callback function type
 */
export type TeacherStreamCallback = (chunk: string, section: string) => void;

/**
 * Run options interface
 */
export interface TeacherRunOptions {
  streaming?: boolean;
  streamCallback?: TeacherStreamCallback;
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
   * Main entry point for Teacher role - processes a message and returns a response
   * Supports both streaming and regular modes
   * @param message Message to process
   * @param options Run options including streaming configuration
   * @returns Processed message response
   */
  async run(message: Message, options?: TeacherRunOptions): Promise<Message> {
    logger.info(`[${this.name}] Processing message using ${options?.streaming ? 'streaming' : 'regular'} mode`);
    
    try {
      // Add the message to memory
      this.context.memory.add(message);
      
      // Process content to determine the appropriate response type
      const content = message.content.toLowerCase();
      let responseContent = '';
      let responseSection = '';
      
      // Determine which type of educational content to generate
      if (content.includes('lesson') || content.includes('plan') || content.includes('teach')) {
        logger.info(`[${this.name}] Creating lesson plan for topic: ${message.content}`);
        responseSection = 'Lesson Plan';
        
        if (options?.streaming && this.llm.chatStream) {
          // Use streaming for lesson plan creation
          responseContent = await this.createLessonPlanStreaming(message.content, options.streamCallback);
        } else {
          // Use regular method
          const result = await this.createLessonPlan(message.content);
          responseContent = result.content;
        }
      } 
      else if (content.includes('explain') || content.includes('what is') || content.includes('how to')) {
        logger.info(`[${this.name}] Explaining concept: ${message.content}`);
        responseSection = 'Concept Explanation';
        
        // Get explain concept action
        const explainAction = this.actions.find(action => action instanceof ExplainConcept) as ExplainConcept;
        
        if (options?.streaming && this.llm.chatStream) {
          // Use streaming for explanation
          const prompt = `Please explain the following concept clearly and concisely: ${message.content}`;
          responseContent = await this.streamResponse(prompt, responseSection, options.streamCallback);
        } else {
          // Use regular method
          const result = await explainAction.run({ concept: message.content });
          responseContent = result.content;
        }
      }
      else if (content.includes('quiz') || content.includes('test') || content.includes('assess')) {
        logger.info(`[${this.name}] Generating quiz for topic: ${message.content}`);
        responseSection = 'Assessment';
        
        if (options?.streaming && this.llm.chatStream) {
          // Use streaming for quiz generation
          responseContent = await this.generateQuizStreaming(message.content, options.streamCallback);
        } else {
          // Use regular method
          const result = await this.generateQuiz(message.content);
          responseContent = result.content;
        }
      }
      else if (content.includes('feedback') || content.includes('evaluate')) {
        logger.info(`[${this.name}] Providing feedback on: ${message.content}`);
        responseSection = 'Feedback';
        
        // For feedback, fallback to regular method as it typically requires structured input
        // Extract question and answer from content if possible
        const parts = message.content.split('\n');
        let question = '';
        let answer = '';
        
        if (parts.length >= 2) {
          question = parts[0];
          answer = parts.slice(1).join('\n');
        } else {
          question = message.content;
          answer = "No specific answer provided";
        }
        
        const result = await this.evaluateAnswer(question, answer);
        responseContent = result.content;
      }
      else {
        // Default to creating a lesson plan for any other type of input
        logger.info(`[${this.name}] Creating default lesson plan for topic: ${message.content}`);
        responseSection = 'Lesson Plan';
        
        if (options?.streaming && this.llm.chatStream) {
          // Use streaming for lesson plan creation
          responseContent = await this.createLessonPlanStreaming(message.content, options.streamCallback);
        } else {
          // Use regular method
          const result = await this.createLessonPlan(message.content);
          responseContent = result.content;
        }
      }
      
      // Create response message
      const response = {
        role: 'assistant',
        content: responseContent,
        id: Date.now().toString(),
        causedBy: this.name,
        sentFrom: this.name,
        sendTo: new Set(['*']),
        timestamp: new Date().toISOString(),
        instructContent: null
      };
      
      // Add response to memory
      this.context.memory.add(response);
      
      return response;
    } catch (error) {
      logger.error(`[${this.name}] Error processing message:`, error);
      return {
        role: 'assistant',
        content: `Error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        id: Date.now().toString(),
        causedBy: this.name,
        sentFrom: this.name,
        sendTo: new Set(['*']),
        timestamp: new Date().toISOString(),
        instructContent: null
      };
    }
  }

  /**
   * Stream a response for a given prompt
   * @param prompt The prompt to send to the LLM
   * @param section Current section being generated
   * @param callback Optional callback function for streaming chunks
   * @returns The complete response
   */
  private async streamResponse(prompt: string, section: string, callback?: TeacherStreamCallback): Promise<string> {
    if (!this.llm.chatStream) {
      logger.warn(`[${this.name}] Streaming not supported by LLM provider, falling back to regular chat`);
      return await this.llm.chat(prompt);
    }
    
    logger.info(`[${this.name}] Streaming response for section: ${section}`);
    let fullResponse = '';
    
    try {
      for await (const chunk of this.llm.chatStream(prompt)) {
        fullResponse += chunk;
        
        // Call the callback if provided
        if (callback) {
          callback(chunk, section);
        }
      }
      
      return fullResponse;
    } catch (error) {
      logger.error(`[${this.name}] Error in streaming response:`, error);
      // Fallback to regular chat
      logger.info(`[${this.name}] Falling back to regular chat`);
      return await this.llm.chat(prompt);
    }
  }

  /**
   * Stream a lesson plan for a given topic
   * @param topic The lesson topic
   * @param callback Optional callback function for streaming chunks
   * @returns The complete lesson plan
   */
  private async createLessonPlanStreaming(topic: string, callback?: TeacherStreamCallback): Promise<string> {
    const section = 'Lesson Plan';
    const prompt = `Create a detailed lesson plan for teaching "${topic}" using a ${this.teachingStyle} approach. Include learning objectives, activities, assessment methods, and timing for each section.`;
    
    return await this.streamResponse(prompt, section, callback);
  }

  /**
   * Stream a quiz for a given topic
   * @param topic The quiz topic
   * @param callback Optional callback function for streaming chunks
   * @returns The complete quiz
   */
  private async generateQuizStreaming(topic: string, callback?: TeacherStreamCallback): Promise<string> {
    const section = 'Quiz';
    const prompt = `Create a comprehensive quiz or assessment on the topic "${topic}". Include a variety of question types (multiple choice, short answer, etc.) along with an answer key.`;
    
    return await this.streamResponse(prompt, section, callback);
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