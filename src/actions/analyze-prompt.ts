/**
 * AnalyzePrompt Action
 * 
 * This action analyzes user prompts to extract key components, requirements,
 * and constraints to help guide the system's response strategy.
 */

import { BaseAction } from './base-action';
import type { ActionOutput } from '../types/action';
import { logger } from '../utils/logger';

export interface PromptAnalysis {
  core_request: string;
  explicit_requirements: string[];
  implicit_requirements: string[];
  constraints: string[];
  context_dependencies: string[];
  assumptions: string[];
  clarification_questions?: string[];
  complexity_assessment: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  estimated_steps: number;
}

export class AnalyzePrompt extends BaseAction {
  constructor(config: any) {
    super({
      name: 'AnalyzePrompt',
      ...config,
    });
  }

  private async analyzePrompt(prompt: string): Promise<PromptAnalysis> {
    logger.debug('[AnalyzePrompt] Analyzing prompt:', prompt);

    const systemPrompt = `You are a prompt analysis expert. Analyze the given prompt and break it down into its key components.
Focus on identifying:
1. The core request/task
2. Explicit requirements clearly stated in the prompt
3. Implicit requirements that can be inferred
4. Any constraints or limitations
5. Dependencies on context or prior knowledge
6. Underlying assumptions
7. Areas that might need clarification
8. Assessment of task complexity
9. Estimated number of steps to complete

Provide your analysis in a structured JSON format matching the PromptAnalysis interface.`;

    try {
      const analysisResponse = await this.llm.chat(systemPrompt + "\n\nPrompt to analyze: " + prompt);
      const analysis = JSON.parse(analysisResponse);

      // Validate and ensure all required fields are present
      return {
        core_request: analysis.core_request || prompt,
        explicit_requirements: analysis.explicit_requirements || [],
        implicit_requirements: analysis.implicit_requirements || [],
        constraints: analysis.constraints || [],
        context_dependencies: analysis.context_dependencies || [],
        assumptions: analysis.assumptions || [],
        clarification_questions: analysis.clarification_questions,
        complexity_assessment: analysis.complexity_assessment || 'MODERATE',
        estimated_steps: analysis.estimated_steps || 1
      };
    } catch (error) {
      logger.error('[AnalyzePrompt] Error analyzing prompt:', error);
      return this.createFallbackAnalysis(prompt);
    }
  }

  private createFallbackAnalysis(prompt: string): PromptAnalysis {
    return {
      core_request: prompt,
      explicit_requirements: [],
      implicit_requirements: [],
      constraints: [],
      context_dependencies: [],
      assumptions: ['Analysis failed, treating as simple request'],
      complexity_assessment: 'SIMPLE',
      estimated_steps: 1
    };
  }

  public async run(): Promise<ActionOutput> {
    const messages = this.context.memory.getMessages();
    if (messages.length === 0) {
      return {
        status: 'failed',
        content: 'No messages available for analysis'
      };
    }

    const lastMessage = messages[messages.length - 1];
    const analysis = await this.analyzePrompt(lastMessage.content);

    const formattedAnalysis = `# Prompt Analysis

## Core Request
${analysis.core_request}

## Requirements
### Explicit
${analysis.explicit_requirements.map(req => `- ${req}`).join('\n')}

### Implicit
${analysis.implicit_requirements.map(req => `- ${req}`).join('\n')}

## Constraints
${analysis.constraints.map(constraint => `- ${constraint}`).join('\n')}

## Context Dependencies
${analysis.context_dependencies.map(dep => `- ${dep}`).join('\n')}

## Assumptions
${analysis.assumptions.map(assumption => `- ${assumption}`).join('\n')}

${analysis.clarification_questions ? `## Clarification Needed
${analysis.clarification_questions.map(q => `- ${q}`).join('\n')}` : ''}

## Assessment
- Complexity: ${analysis.complexity_assessment}
- Estimated Steps: ${analysis.estimated_steps}`;

    return {
      status: 'completed',
      content: formattedAnalysis
    };
  }
} 