import { BaseAction } from './base-action';
import type { StreamActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Difficulty levels for concept explanation
 */
export enum ExplanationLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

/**
 * Learning style preferences
 */
export enum LearningStyle {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  READING = 'reading',
  KINESTHETIC = 'kinesthetic'
}

/**
 * Example type for concept explanation
 */
export interface ConceptExample {
  context: string;
  code?: string;
  explanation: string;
  keyPoints: string[];
}

/**
 * Visual aid type for concept explanation
 */
export interface VisualAid {
  type: 'diagram' | 'flowchart' | 'mindmap' | 'comparison';
  description: string;
  elements: {
    id: string;
    label: string;
    details?: string;
    connections?: string[];
  }[];
}

/**
 * Practice exercise type
 */
export interface PracticeExercise {
  id: string;
  type: 'multiple_choice' | 'coding' | 'open_ended';
  question: string;
  difficulty: ExplanationLevel;
  hints?: string[];
  solution?: string;
  explanation?: string;
}

/**
 * Related concept type
 */
export interface RelatedConcept {
  name: string;
  relationship: 'prerequisite' | 'similar' | 'advanced' | 'alternative';
  description: string;
  importance: 'essential' | 'helpful' | 'optional';
}

/**
 * Concept explanation result
 */
export interface ConceptExplanation {
  overview: {
    concept: string;
    shortDefinition: string;
    level: ExplanationLevel;
    targetAudience: string[];
    prerequisites: string[];
  };
  coreConcepts: {
    definition: string;
    keyPoints: string[];
    commonMisconceptions: string[];
  };
  explanation: {
    mainContent: string;
    sections: {
      title: string;
      content: string;
      importance: 'high' | 'medium' | 'low';
    }[];
    visualAids: VisualAid[];
  };
  examples: ConceptExample[];
  practice: {
    exercises: PracticeExercise[];
    projects: {
      title: string;
      description: string;
      steps: string[];
      learningOutcomes: string[];
    }[];
  };
  connections: {
    relatedConcepts: RelatedConcept[];
    realWorldApplications: string[];
    industryUsage: string[];
  };
  resources: {
    documentation: string[];
    tutorials: string[];
    books: string[];
    communities: string[];
  };
}

export interface ExplainConceptConfig extends ActionConfig {
  field?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  format?: 'text' | 'markdown' | 'html';
  includeExamples?: boolean;
  includeAnalogies?: boolean;
}

/**
 * Action for explaining concepts clearly and comprehensively
 */
export class ExplainConcept extends BaseAction {
  private field: string;
  private level: 'beginner' | 'intermediate' | 'advanced';
  private format: 'text' | 'markdown' | 'html';
  private includeExamples: boolean;
  private includeAnalogies: boolean;

  constructor(config: ExplainConceptConfig) {
    super({
      ...config,
      name: config.name || 'ExplainConcept',
      description: config.description || 'Explain concepts clearly and comprehensively'
    });

    this.field = config.field || 'general';
    this.level = config.level || 'intermediate';
    this.format = config.format || 'markdown';
    this.includeExamples = config.includeExamples ?? true;
    this.includeAnalogies = config.includeAnalogies ?? true;
  }

  protected async prompt(): Promise<string> {
    const concept = this.getArg<string>('concept');
    const context = this.getArg<string>('context') || '';
    const priorKnowledge = this.getArg<string[]>('priorKnowledge') || [];

    if (!concept) {
      throw new Error('No concept provided for explanation');
    }

    return `As an expert in ${this.field}, explain the following concept at a ${this.level} level:

Concept: ${concept}

${context ? `Context:\n${context}\n\n` : ''}
${priorKnowledge.length ? `Assumed Prior Knowledge:\n${priorKnowledge.map(k => `- ${k}`).join('\n')}\n\n` : ''}

Please provide a comprehensive explanation including:
1. Clear definition
2. Key points and principles
${this.includeExamples ? '3. Practical examples and use cases' : ''}
${this.includeAnalogies ? '4. Helpful analogies and comparisons' : ''}
5. Common misconceptions
6. Related concepts
7. Further reading suggestions

Focus on:
- Clear and concise explanations
- Logical flow of ideas
- Real-world relevance
- Common pitfalls to avoid
- Building on prior knowledge
- Progressive complexity`;
  }

  public async run(): Promise<StreamActionOutput> {
    try {
      const concept = this.getArg<string>('concept');
      if (!concept) {
        return {
          content: 'No concept provided for explanation',
          status: 'failed'
        };
      }

      const response = await this.ask(await this.prompt());
      
      return {
        content: response,
        status: 'completed',
        metadata: {
          field: this.field,
          level: this.level,
          format: this.format,
          includeExamples: this.includeExamples,
          includeAnalogies: this.includeAnalogies
        }
      };
    } catch (error: unknown) {
      logger.error('[ExplainConcept] Error:', error);
      return {
        content: `Failed to explain concept: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed'
      };
    }
  }
} 