/**
 * WriteTutorial Action
 * 
 * This action generates educational tutorials and guides, breaking down complex topics
 * into clear, step-by-step instructions with examples and explanations.
 */

import { BaseAction } from './base-action';
import type { ActionOutput } from '../types/action';
import { logger } from '../utils/logger';
import { parseJsonWithZod } from '../utils/common';
import { z } from 'zod';

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

// 使用Zod定义Directory的模式
export const DirectorySchema = z.object({
  title: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      subsections: z.array(
        z.object({
          title: z.string(),
          content: z.string().optional()
        })
      )
    })
  )
});

// 从Zod模式推断类型
export type Directory = z.infer<typeof DirectorySchema>;

// 使用Zod定义TutorialSection的模式
export const TutorialSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  code_examples: z.array(z.string()).optional(),
  key_points: z.array(z.string()).optional(),
  exercises: z.array(
    z.object({
      description: z.string(),
      solution: z.string().optional()
    })
  ).optional()
});

// 使用Zod定义Tutorial的模式
export const TutorialSchema = z.object({
  title: z.string(),
  description: z.string(),
  prerequisites: z.array(z.string()),
  learning_objectives: z.array(z.string()),
  difficulty_level: z.nativeEnum(TutorialLevel),
  format: z.nativeEnum(TutorialFormat),
  estimated_time: z.string(),
  sections: z.array(TutorialSectionSchema),
  summary: z.string(),
  further_reading: z.array(z.string()).optional(),
  keywords: z.array(z.string())
});

// 从Zod模式推断类型
export type TutorialSection = z.infer<typeof TutorialSectionSchema>;
export type Tutorial = z.infer<typeof TutorialSchema>;

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

export class WriteDirectory extends BaseAction {
  language: string;

  constructor(config: { 
    name?: string;
    llm: any;
    language?: string;
    memory?: any;
  }) {
    const messages: any[] = [];
    super({
      name: config.name || 'WriteDirectory',
      llm: config.llm,
      memory: config.memory || {
        getMessages: () => messages,
        add: (msg: any) => { messages.push(msg); },
        get: () => messages,
        clear: () => { messages.length = 0; }
      }
    });
    this.language = config.language || 'Chinese';
  }

  public async run(): Promise<ActionOutput> {
    const topic = this.getArg<string>('topic');
    if (!topic) {
      return {
        status: 'failed',
        content: 'Topic argument is required'
      };
    }

    logger.debug('[WriteDirectory] Generating directory for:', topic);

    const systemPrompt = `You are an expert technical writer. Create a well-structured directory for a tutorial on the given topic.
The directory should be:
1. Clear and logical
2. Well-organized with main sections and subsections
3. Cover all important aspects of the topic

Provide your directory in a structured JSON format matching the following schema:
{
  "title": "Tutorial Title",
  "sections": [
    {
      "title": "Section Title",
      "subsections": [
        {
          "title": "Subsection Title",
          "content": "Optional brief description of subsection content"
        }
      ]
    }
  ]
}`;

    try {
      const directoryResponse = await this.llm.chat(systemPrompt + "\n\nTopic: " + topic);
      console.log(directoryResponse);
      
      // 使用Zod验证解析JSON
      const directory = parseJsonWithZod<Directory>(
        directoryResponse, 
        DirectorySchema,
        // 提供默认值，避免解析失败时抛出错误
        {
          title: topic,
          sections: [
            {
              title: "Introduction",
              subsections: [
                {
                  title: "Overview",
                  content: "Basic introduction to the topic"
                }
              ]
            }
          ]
        }
      );

      return {
        status: 'completed',
        content: 'Directory structure generated successfully',
        instructContent: directory
      };
    } catch (error) {
      logger.error('[WriteDirectory] Error generating directory:', error);
      return {
        status: 'failed',
        content: `Error generating directory: ${error}`
      };
    }
  }
}

export class WriteContent extends BaseAction {
  language: string;
  directory: Directory;

  constructor(config: { 
    name?: string;
    llm: any;
    language?: string;
    directory: Directory;
    memory?: any;
  }) {
    const messages: any[] = [];
    super({
      name: config.name || 'WriteContent',
      llm: config.llm,
      memory: config.memory || {
        getMessages: () => messages,
        add: (msg: any) => { messages.push(msg); },
        get: () => messages,
        clear: () => { messages.length = 0; }
      }
    });
    this.language = config.language || 'Chinese';
    this.directory = config.directory;
  }

  public async run(): Promise<ActionOutput> {
    const topic = this.getArg<string>('topic');
    if (!topic) {
      return {
        status: 'failed',
        content: 'Topic argument is required'
      };
    }

    logger.debug('[WriteContent] Generating content for:', topic);

    const systemPrompt = `You are an expert technical writer. Create detailed content for the given section of the tutorial.
The content should be:
1. Clear and comprehensive
2. Include examples where appropriate
3. Follow Markdown syntax
4. Match the section structure provided

Write the content in ${this.language} language.`;

    try {
      // 获取第一个章节
      const section = this.directory.sections[0];
      if (!section) {
        return {
          status: 'failed',
          content: 'No sections found in directory'
        };
      }

      const contentPrompt = `
Topic: ${topic}
Section: ${section.title}
Subsections: ${JSON.stringify(section.subsections.map(sub => sub.title))}

Please write detailed content for this section and its subsections.`;

      const contentResponse = await this.llm.chat(systemPrompt + "\n\n" + contentPrompt);

      return {
        status: 'completed',
        content: contentResponse
      };
    } catch (error) {
      logger.error('[WriteContent] Error generating content:', error);
      return {
        status: 'failed',
        content: `Error generating content: ${error}`
      };
    }
  }
}

export class WriteTutorial extends BaseAction {
  protected args: WriteTutorialArgs;

  constructor(config: { 
    name: string;
    llm: any;
    args?: WriteTutorialArgs;
    memory?: any;
  }) {
    const messages: any[] = [];
    super({
      name: config.name,
      llm: config.llm,
      memory: config.memory || {
        getMessages: () => messages,
        add: (msg: any) => { messages.push(msg); },
        get: () => messages,
        clear: () => { messages.length = 0; }
      }
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

Provide your tutorial in a structured JSON format matching the Tutorial schema.`;

    try {
      const tutorialResponse = await this.llm.chat(systemPrompt + "\n\nTutorial request: " + JSON.stringify(config));
      
      // 使用Zod验证解析JSON
      return parseJsonWithZod<Tutorial>(
        tutorialResponse, 
        TutorialSchema,
        this.createFallbackTutorial(config)
      );
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