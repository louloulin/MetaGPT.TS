/**
 * Chain of Thought Reasoning Utility
 * 
 * Provides structured tools for implementing step-by-step reasoning
 * to enhance problem-solving capabilities in roles.
 * 
 * @module utils/chain-of-thought
 * @category Core
 */

import { z } from 'zod';
import type { LLMProvider } from '../types/llm';
import { logger } from './logger';

/**
 * Step Schema for CoT reasoning
 */
export const ReasoningStepSchema = z.object({
  /** Step number in the chain */
  stepNumber: z.number(),
  /** Step description */
  description: z.string(),
  /** Step reasoning */
  reasoning: z.string(),
  /** Step conclusion */
  conclusion: z.string().optional(),
  /** Step confidence (0-1) */
  confidence: z.number().min(0).max(1).optional(),
  /** References used in this step */
  references: z.array(z.string()).optional(),
  /** Metadata for this step */
  metadata: z.record(z.any()).optional(),
});

export type ReasoningStep = z.infer<typeof ReasoningStepSchema>;

/**
 * Chain of Thought Schema
 */
export const ChainOfThoughtSchema = z.object({
  /** Problem or question being addressed */
  problem: z.string(),
  /** Context provided for reasoning */
  context: z.string().optional(),
  /** Reasoning steps */
  steps: z.array(ReasoningStepSchema),
  /** Final answer or solution */
  solution: z.string().optional(),
  /** Overall confidence in solution (0-1) */
  confidence: z.number().min(0).max(1).optional(),
  /** Whether the chain is complete */
  isComplete: z.boolean().default(false),
  /** Metadata for the chain */
  metadata: z.record(z.any()).optional(),
});

export type ChainOfThought = z.infer<typeof ChainOfThoughtSchema>;

/**
 * Chain of Thought Builder
 * Helps construct a reasoning chain step by step
 */
export class ChainOfThoughtBuilder {
  private chain: ChainOfThought;
  private llm?: LLMProvider;
  
  /**
   * Create a new chain of thought
   */
  constructor(problem: string, context?: string, llm?: LLMProvider) {
    this.chain = {
      problem,
      context,
      steps: [],
      isComplete: false
    };
    this.llm = llm;
  }
  
  /**
   * Add a reasoning step manually
   */
  addStep(step: Omit<ReasoningStep, 'stepNumber'>): ChainOfThoughtBuilder {
    const stepNumber = this.chain.steps.length + 1;
    this.chain.steps.push({
      ...step,
      stepNumber
    });
    return this;
  }
  
  /**
   * Generate a reasoning step using the LLM
   */
  async generateStep(prompt?: string): Promise<ChainOfThoughtBuilder> {
    if (!this.llm) {
      throw new Error('LLM provider required to generate steps');
    }
    
    const stepNumber = this.chain.steps.length + 1;
    const previousSteps = this.chain.steps.map(s => 
      `Step ${s.stepNumber}: ${s.description}\nReasoning: ${s.reasoning}${s.conclusion ? `\nConclusion: ${s.conclusion}` : ''}`
    ).join('\n\n');
    
    // Create the prompt for generating the next step
    const systemPrompt = `
    You are a reasoning assistant that helps with step-by-step problem solving.
    You will generate the next logical step in a chain-of-thought reasoning process.
    
    The step should include:
    1. A clear description of what this step is analyzing or considering
    2. Detailed reasoning showing your thought process
    3. A conclusion for this specific step
    
    Format your response as:
    DESCRIPTION: [Brief description of this reasoning step]
    REASONING: [Detailed reasoning process]
    CONCLUSION: [Conclusion for this step]
    CONFIDENCE: [Number between 0-1 representing confidence]
    `;
    
    const userPrompt = prompt || `
    Problem: ${this.chain.problem}
    ${this.chain.context ? `Context: ${this.chain.context}\n` : ''}
    ${previousSteps ? `Previous steps:\n${previousSteps}\n` : ''}
    
    Please generate Step ${stepNumber} in the reasoning chain.
    `;
    
    try {
      // Generate the step using the LLM
      const response = await this.llm.generate(userPrompt, {
        systemPrompt: systemPrompt
      });
      
      // Parse the response
      const descriptionMatch = response.match(/DESCRIPTION: (.*?)(?=\nREASONING:|$)/s);
      const reasoningMatch = response.match(/REASONING: (.*?)(?=\nCONCLUSION:|$)/s);
      const conclusionMatch = response.match(/CONCLUSION: (.*?)(?=\nCONFIDENCE:|$)/s);
      const confidenceMatch = response.match(/CONFIDENCE: (.*?)(?=\n|$)/s);
      
      if (!descriptionMatch || !reasoningMatch) {
        throw new Error('Could not parse LLM response for reasoning step');
      }
      
      const description = descriptionMatch[1].trim();
      const reasoning = reasoningMatch[1].trim();
      const conclusion = conclusionMatch ? conclusionMatch[1].trim() : undefined;
      const confidenceStr = confidenceMatch ? confidenceMatch[1].trim() : undefined;
      const confidence = confidenceStr ? parseFloat(confidenceStr) : undefined;
      
      // Add the generated step
      this.addStep({
        description,
        reasoning,
        conclusion,
        confidence: confidence && !isNaN(confidence) ? Math.min(Math.max(confidence, 0), 1) : undefined
      });
      
      return this;
    } catch (error) {
      logger.error('Error generating reasoning step:', error);
      throw error;
    }
  }
  
  /**
   * Generate a solution based on the reasoning steps
   */
  async generateSolution(): Promise<string> {
    if (!this.llm) {
      throw new Error('LLM provider required to generate solution');
    }
    
    if (this.chain.steps.length === 0) {
      throw new Error('Cannot generate solution without reasoning steps');
    }
    
    const stepsText = this.chain.steps.map(s => 
      `Step ${s.stepNumber}: ${s.description}\nReasoning: ${s.reasoning}${s.conclusion ? `\nConclusion: ${s.conclusion}` : ''}`
    ).join('\n\n');
    
    const prompt = `
    Problem: ${this.chain.problem}
    ${this.chain.context ? `Context: ${this.chain.context}\n` : ''}
    
    Reasoning steps:
    ${stepsText}
    
    Based on the above chain of reasoning, provide a comprehensive solution to the problem.
    Your solution should synthesize the insights from all steps and clearly address the original problem.
    `;
    
    try {
      const solution = await this.llm.generate(prompt);
      this.chain.solution = solution;
      this.chain.isComplete = true;
      return solution;
    } catch (error) {
      logger.error('Error generating solution:', error);
      throw error;
    }
  }
  
  /**
   * Get the current state of the chain
   */
  getChain(): ChainOfThought {
    return this.chain;
  }
  
  /**
   * Set the LLM provider
   */
  setLLM(llm: LLMProvider): ChainOfThoughtBuilder {
    this.llm = llm;
    return this;
  }
  
  /**
   * Set the confidence of the chain
   */
  setConfidence(confidence: number): ChainOfThoughtBuilder {
    this.chain.confidence = Math.min(Math.max(confidence, 0), 1);
    return this;
  }
  
  /**
   * Mark the chain as complete
   */
  complete(solution?: string): ChainOfThoughtBuilder {
    if (solution) {
      this.chain.solution = solution;
    }
    this.chain.isComplete = true;
    return this;
  }
  
  /**
   * Create a markdown representation of the chain
   */
  toMarkdown(): string {
    let md = `# ${this.chain.problem}\n\n`;
    
    if (this.chain.context) {
      md += `## Context\n${this.chain.context}\n\n`;
    }
    
    md += `## Reasoning Chain\n\n`;
    
    for (const step of this.chain.steps) {
      md += `### Step ${step.stepNumber}: ${step.description}\n\n`;
      md += `**Reasoning:**\n${step.reasoning}\n\n`;
      
      if (step.conclusion) {
        md += `**Conclusion:**\n${step.conclusion}\n\n`;
      }
      
      if (step.confidence !== undefined) {
        md += `**Confidence:** ${(step.confidence * 100).toFixed(1)}%\n\n`;
      }
      
      if (step.references && step.references.length > 0) {
        md += `**References:**\n`;
        step.references.forEach(ref => {
          md += `- ${ref}\n`;
        });
        md += '\n';
      }
    }
    
    if (this.chain.solution) {
      md += `## Solution\n\n${this.chain.solution}\n\n`;
      
      if (this.chain.confidence !== undefined) {
        md += `**Overall Confidence:** ${(this.chain.confidence * 100).toFixed(1)}%\n\n`;
      }
    }
    
    return md;
  }
} 