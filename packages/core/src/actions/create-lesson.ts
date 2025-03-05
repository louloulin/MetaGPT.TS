import { BaseAction } from './base-action';
import type { StreamActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Teaching style preferences
 */
export enum TeachingStyle {
  LECTURE = 'lecture',
  INTERACTIVE = 'interactive',
  PROJECT_BASED = 'project_based',
  PROBLEM_BASED = 'problem_based',
  FLIPPED = 'flipped',
  BLENDED = 'blended',
  ADAPTIVE = 'adaptive'
}

/**
 * Learning objective type
 */
export interface LearningObjective {
  id: string;
  description: string;
  category: 'knowledge' | 'comprehension' | 'application' | 'analysis' | 'synthesis' | 'evaluation';
  assessmentCriteria: string[];
}

/**
 * Course material type
 */
export interface CourseMaterial {
  type: 'reading' | 'video' | 'audio' | 'interactive' | 'worksheet';
  title: string;
  description: string;
  url?: string;
  duration?: number;
  requiredResources?: string[];
}

/**
 * Teaching activity type
 */
export interface TeachingActivity {
  id: string;
  title: string;
  description: string;
  duration: number;
  type: 'introduction' | 'presentation' | 'discussion' | 'exercise' | 'group_work' | 'assessment';
  objectives: string[];
  materials: CourseMaterial[];
  instructions: {
    teacher: string[];
    student: string[];
  };
  adaptations?: {
    advanced: string;
    struggling: string;
  };
}

/**
 * Assessment method type
 */
export interface AssessmentMethod {
  id: string;
  type: 'quiz' | 'project' | 'presentation' | 'essay' | 'practical';
  title: string;
  description: string;
  objectives: string[];
  criteria: {
    category: string;
    description: string;
    weight: number;
  }[];
  rubric?: {
    excellent: string;
    good: string;
    satisfactory: string;
    needsImprovement: string;
  };
}

/**
 * Lesson plan type
 */
export interface LessonPlan {
  title: string;
  objectives: string[];
  prerequisites: string[];
  duration: number;
  materials: string[];
  outline: {
    section: string;
    duration: number;
    content: string;
    activities?: string[];
  }[];
  exercises?: {
    type: 'quiz' | 'practice' | 'project';
    question: string;
    solution?: string;
    hints?: string[];
  }[];
  assessment: {
    criteria: string[];
    methods: string[];
  };
  resources: {
    required: string[];
    optional: string[];
  };
}

export interface CreateLessonConfig extends ActionConfig {
  subject?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  format?: 'text' | 'markdown' | 'html';
  duration?: number; // in minutes
  includeExercises?: boolean;
}

/**
 * Action for creating detailed lesson plans
 */
export class CreateLesson extends BaseAction {
  private subject: string;
  private level: 'beginner' | 'intermediate' | 'advanced';
  private format: 'text' | 'markdown' | 'html';
  private duration: number;
  private includeExercises: boolean;

  constructor(config: CreateLessonConfig) {
    super({
      ...config,
      name: config.name || 'CreateLesson',
      description: config.description || 'Create a detailed lesson plan'
    });

    this.subject = config.subject || 'general';
    this.level = config.level || 'intermediate';
    this.format = config.format || 'markdown';
    this.duration = config.duration || 60;
    this.includeExercises = config.includeExercises ?? true;
  }

  protected async prompt(): Promise<string> {
    const topic = this.getArg<string>('topic');
    const objectives = this.getArg<string[]>('objectives') || [];
    const context = this.getArg<string>('context') || '';

    if (!topic) {
      throw new Error('No topic provided for lesson creation');
    }

    return `As an experienced educator in ${this.subject}, create a detailed ${this.level}-level lesson plan for:

Topic: ${topic}

${objectives.length ? `Learning Objectives:\n${objectives.map(obj => `- ${obj}`).join('\n')}\n\n` : ''}
${context ? `Context:\n${context}\n\n` : ''}

Requirements:
- Total Duration: ${this.duration} minutes
- Format: ${this.format}
- Include exercises: ${this.includeExercises ? 'Yes' : 'No'}

Please provide a comprehensive lesson plan including:
1. Clear learning objectives
2. Required prerequisites
3. Detailed timeline and outline
4. Engaging activities and examples
5. Assessment methods
6. Required materials and resources
${this.includeExercises ? '7. Practice exercises with solutions' : ''}

Focus on:
- Clear explanation of concepts
- Practical examples and applications
- Student engagement and interaction
- Knowledge assessment and feedback
- Time management
- Learning reinforcement`;
  }

  public async run(): Promise<StreamActionOutput> {
    try {
      const topic = this.getArg<string>('topic');
      if (!topic) {
        return {
          content: 'No topic provided for lesson creation',
          status: 'failed'
        };
      }

      const response = await this.ask(await this.prompt());
      
      return {
        content: response,
        status: 'completed',
        metadata: {
          subject: this.subject,
          level: this.level,
          format: this.format,
          duration: this.duration,
          includeExercises: this.includeExercises
        }
      };
    } catch (error: unknown) {
      logger.error('[CreateLesson] Error:', error);
      return {
        content: `Failed to create lesson plan: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed'
      };
    }
  }
} 