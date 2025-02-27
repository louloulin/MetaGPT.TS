/**
 * WriteTutorial Action
 * 
 * This action generates educational tutorials and guides, breaking down complex topics
 * into clear, step-by-step instructions with examples and explanations.
 */

import { BaseAction } from './base-action';
import type { ActionOutput } from '../types/action';
import { logger } from '../utils/logger';

export enum TutorialLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED'
}

export enum TutorialFormat {
  STEP_BY_STEP = 'STEP_BY_STEP',
  CONCEPT_BASED = 'CONCEPT_BASED',
  PROJECT_BASED = 'PROJECT_BASED',
  REFERENCE_GUIDE = 'REFERENCE_GUIDE'
}

export interface TutorialSection {
  title: string;
  content: string;
  code_examples?: string[];
  key_points?: string[];
  exercises?: {
    description: string;
    solution?: string;
  }[];
}

export interface Tutorial {
  title: string;
  description: string;
  prerequisites: string[];
  learning_objectives: string[];
  difficulty_level: TutorialLevel;
  format: TutorialFormat;
  estimated_time: string;
  sections: TutorialSection[];
  summary: string;
  further_reading?: string[];
  keywords: string[];
}

export interface WriteTutorialConfig {
  topic: string;
  level?: TutorialLevel;
  format?: TutorialFormat;
  include_exercises?: boolean;
  target_audience?: string;
  max_length?: number;
  focus_areas?: string[];
}

export interface WriteTutorialArgs {
  level?: TutorialLevel;
  format?: TutorialFormat;
  include_exercises?: boolean;
  target_audience?: string;
  max_length?: number;
  focus_areas?: string[];
}

export class WriteTutorial extends BaseAction {
  protected args: WriteTutorialArgs;

  constructor(config: any) {
    super({
      name: 'WriteTutorial',
      ...config,
    });
    this.args = config.args || {};
  }

  private async generateTutorial(config: WriteTutorialConfig): Promise<Tutorial> {
    logger.debug('[WriteTutorial] Generating tutorial for:', config.topic);

    const systemPrompt = `You are an expert technical writer and educator. Create a comprehensive tutorial on the given topic.
The tutorial should be:
1. Clear and well-structured
2. Appropriate for the specified difficulty level
3. Include practical examples and explanations
4. Follow the specified format
5. Include exercises if requested
6. Target the specified audience

Provide your tutorial in a structured JSON format matching the Tutorial interface.`;

    try {
      const tutorialResponse = await this.llm.chat(systemPrompt + "\n\nTutorial request: " + JSON.stringify(config));
      const tutorial = JSON.parse(tutorialResponse);

      // Validate and ensure all required fields are present
      return {
        title: tutorial.title || config.topic,
        description: tutorial.description || '',
        prerequisites: tutorial.prerequisites || [],
        learning_objectives: tutorial.learning_objectives || [],
        difficulty_level: tutorial.difficulty_level || config.level || TutorialLevel.BEGINNER,
        format: tutorial.format || config.format || TutorialFormat.STEP_BY_STEP,
        estimated_time: tutorial.estimated_time || '30 minutes',
        sections: tutorial.sections || [],
        summary: tutorial.summary || '',
        further_reading: tutorial.further_reading,
        keywords: tutorial.keywords || []
      };
    } catch (error) {
      logger.error('[WriteTutorial] Error generating tutorial:', error);
      return this.createFallbackTutorial(config);
    }
  }

  private createFallbackTutorial(config: WriteTutorialConfig): Tutorial {
    return {
      title: config.topic,
      description: 'A basic guide to understanding ' + config.topic,
      prerequisites: [],
      learning_objectives: ['Understand the basics of ' + config.topic],
      difficulty_level: config.level || TutorialLevel.BEGINNER,
      format: config.format || TutorialFormat.STEP_BY_STEP,
      estimated_time: '30 minutes',
      sections: [{
        title: 'Introduction',
        content: 'This is a basic introduction to ' + config.topic,
        key_points: ['Basic understanding of ' + config.topic]
      }],
      summary: 'This tutorial covers the basics of ' + config.topic,
      keywords: [config.topic]
    };
  }

  private formatTutorial(tutorial: Tutorial): string {
    return `# ${tutorial.title}

${tutorial.description}

## Overview
- Level: ${tutorial.difficulty_level}
- Format: ${tutorial.format}
- Estimated Time: ${tutorial.estimated_time}

## Prerequisites
${tutorial.prerequisites.map(prereq => `- ${prereq}`).join('\n')}

## Learning Objectives
${tutorial.learning_objectives.map(obj => `- ${obj}`).join('\n')}

${tutorial.sections.map(section => `
## ${section.title}

${section.content}

${section.code_examples ? `### Examples
\`\`\`
${section.code_examples.join('\n\n')}
\`\`\`
` : ''}

${section.key_points ? `### Key Points
${section.key_points.map(point => `- ${point}`).join('\n')}
` : ''}

${section.exercises ? `### Exercises
${section.exercises.map(exercise => `
#### Exercise
${exercise.description}

${exercise.solution ? `<details>
<summary>Solution</summary>

${exercise.solution}
</details>` : ''}`).join('\n')}
` : ''}`).join('\n')}

## Summary
${tutorial.summary}

${tutorial.further_reading ? `## Further Reading
${tutorial.further_reading.map(resource => `- ${resource}`).join('\n')}` : ''}

## Keywords
${tutorial.keywords.join(', ')}`;
  }

  public async run(): Promise<ActionOutput> {
    const messages = this.context.memory.getMessages();
    if (messages.length === 0) {
      return {
        status: 'failed',
        content: 'No messages available for tutorial generation'
      };
    }

    const lastMessage = messages[messages.length - 1];
    const config: WriteTutorialConfig = {
      topic: lastMessage.content,
      level: this.args?.level || TutorialLevel.BEGINNER,
      format: this.args?.format || TutorialFormat.STEP_BY_STEP,
      include_exercises: this.args?.include_exercises || false,
      target_audience: this.args?.target_audience || 'general',
      max_length: this.args?.max_length || 5000,
      focus_areas: this.args?.focus_areas || []
    };

    const tutorial = await this.generateTutorial(config);
    const formattedTutorial = this.formatTutorial(tutorial);

    return {
      status: 'completed',
      content: formattedTutorial
    };
  }
} 