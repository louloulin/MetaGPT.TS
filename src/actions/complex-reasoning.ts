/**
 * ComplexReasoning Action
 * 
 * This action performs multi-step reasoning to solve complex problems,
 * breaking down problems into sub-problems, applying logical analysis,
 * and generating structured solutions.
 */

import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Reasoning method types
 */
export enum ReasoningMethod {
  DEDUCTIVE = 'DEDUCTIVE',     // Reasoning from general principles to specific conclusions
  INDUCTIVE = 'INDUCTIVE',     // Reasoning from specific observations to general conclusions
  ABDUCTIVE = 'ABDUCTIVE',     // Reasoning to the most likely explanation
  ANALOGICAL = 'ANALOGICAL',   // Reasoning by comparing similar situations
  CAUSAL = 'CAUSAL',           // Reasoning about cause and effect relationships
  COUNTERFACTUAL = 'COUNTERFACTUAL', // Reasoning about what might have happened
  BAYESIAN = 'BAYESIAN'        // Probabilistic reasoning
}

/**
 * Reasoning step type
 */
export interface ReasoningStep {
  step_number: number;
  description: string;
  method: ReasoningMethod;
  input: string;
  output: string;
  confidence: number; // 0-1 confidence score
  justification: string;
}

/**
 * Structured sub-problem
 */
export interface SubProblem {
  id: string;
  description: string;
  prerequisites: string[]; // IDs of sub-problems that must be solved first
  solution?: string;
  reasoning_steps?: ReasoningStep[];
}

/**
 * Alternative solution with pros and cons
 */
export interface AlternativeSolution {
  description: string;
  pros: string[];
  cons: string[];
  confidence: number; // 0-1 confidence score
}

/**
 * Final reasoning result
 */
export interface ReasoningResult {
  // Problem analysis
  problem_statement: string;
  problem_analysis: string;
  assumptions: string[];
  
  // Problem decomposition
  sub_problems: SubProblem[];
  
  // Reasoning process
  reasoning_path: ReasoningStep[];
  
  // Conclusions and solutions
  conclusion: string;
  recommended_solution: string;
  alternative_solutions: AlternativeSolution[];
  
  // Meta-reasoning
  confidence_score: number; // 0-1 overall confidence in the solution
  limitations: string[];
  additional_information_needed?: string[];
}

/**
 * Configuration for the complex reasoning process
 */
export interface ReasoningConfig {
  problem: string;
  context?: string;
  max_steps?: number;
  reasoning_methods?: ReasoningMethod[];
  required_confidence?: number; // Minimum confidence to accept solution
  domain_specific_knowledge?: string;
  time_constraints?: string;
}

/**
 * Action for performing complex multi-step reasoning
 */
export class ComplexReasoning extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'ComplexReasoning',
      description: config.description || 'Performs multi-step reasoning to solve complex problems by breaking them down and applying logical analysis',
    });
  }

  /**
   * Runs the ComplexReasoning action
   * @returns The reasoning results
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running ComplexReasoning action`);
      
      // Get the problem from the context
      const problem = this.getArg<string>('problem');
      
      if (!problem) {
        return this.createOutput(
          'No problem statement provided for reasoning. Please provide a problem to solve.',
          'failed'
        );
      }

      // Get optional configuration
      const context = this.getArg<string>('context') || '';
      const maxSteps = this.getArg<number>('max_steps') || 10;
      const requiredConfidence = this.getArg<number>('required_confidence') || 0.7;
      const domainKnowledge = this.getArg<string>('domain_specific_knowledge') || '';
      const timeConstraints = this.getArg<string>('time_constraints') || '';
      
      // Select reasoning methods if specified
      const specifiedMethods = this.getArg<ReasoningMethod[]>('reasoning_methods');
      const reasoningMethods = specifiedMethods || Object.values(ReasoningMethod);

      // Perform the complex reasoning
      const reasoningResult = await this.performReasoning({
        problem,
        context,
        max_steps: maxSteps,
        reasoning_methods: reasoningMethods,
        required_confidence: requiredConfidence,
        domain_specific_knowledge: domainKnowledge,
        time_constraints: timeConstraints
      });

      // Format the reasoning result
      const formattedResult = this.formatReasoningResult(reasoningResult);
      
      return this.createOutput(
        formattedResult,
        'completed',
        reasoningResult
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in ComplexReasoning action:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to perform complex reasoning: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Performs the complex reasoning process
   * @param config The reasoning configuration
   * @returns The reasoning result
   */
  private async performReasoning(config: ReasoningConfig): Promise<ReasoningResult> {
    logger.info(`[${this.name}] Performing complex reasoning for problem: ${config.problem.substring(0, 50)}...`);
    
    // Construct the prompt for complex reasoning
    const prompt = this.constructReasoningPrompt(config);
    
    try {
      // Get LLM response
      const response = await this.ask(prompt);
      
      // Parse the reasoning result
      const reasoningResult = JSON.parse(response) as ReasoningResult;
      
      // Validate the confidence score
      if (reasoningResult.confidence_score < config.required_confidence!) {
        logger.warn(`[${this.name}] Reasoning confidence (${reasoningResult.confidence_score}) below required threshold (${config.required_confidence})`);
        reasoningResult.limitations.push(`Solution confidence (${reasoningResult.confidence_score}) is below the required threshold (${config.required_confidence})`);
      }
      
      return reasoningResult;
    } catch (error) {
      logger.error(`[${this.name}] Error parsing LLM response for reasoning:`, error);
      
      // Create a fallback reasoning result
      return this.createFallbackReasoningResult(config.problem, error as Error);
    }
  }

  /**
   * Constructs a prompt for the complex reasoning process
   * @param config The reasoning configuration
   * @returns The constructed prompt
   */
  private constructReasoningPrompt(config: ReasoningConfig): string {
    // List of available reasoning methods
    const methodsList = config.reasoning_methods!.map(method => `- ${method}: ${this.getMethodDescription(method)}`).join('\n');
    
    // Construct the prompt
    return `
    # Complex Reasoning Task

    ## Problem Statement
    ${config.problem}

    ${config.context ? `## Additional Context\n${config.context}\n` : ''}
    ${config.domain_specific_knowledge ? `## Domain Knowledge\n${config.domain_specific_knowledge}\n` : ''}

    ## Task
    Analyze the problem through multi-step reasoning to arrive at a well-justified solution.

    Available reasoning methods:
    ${methodsList}

    Constraints:
    - Maximum number of reasoning steps: ${config.max_steps}
    - Required minimum solution confidence: ${config.required_confidence}
    ${config.time_constraints ? `- Time constraints: ${config.time_constraints}\n` : ''}

    ## Instructions
    1. Analyze the problem thoroughly
    2. Break it down into sub-problems if necessary
    3. Apply appropriate reasoning methods for each step
    4. Generate a structured solution with justifications
    5. Consider alternatives and provide pros/cons
    6. Assess confidence in your solution

    ## Response Format
    Provide your response as a JSON object with the following structure:
    {
      "problem_statement": "Restate the problem in your own words",
      "problem_analysis": "Detailed analysis of the problem",
      "assumptions": ["List all assumptions made in your reasoning"],
      
      "sub_problems": [
        {
          "id": "unique-id",
          "description": "Description of the sub-problem",
          "prerequisites": ["ids of prerequisites"],
          "solution": "Solution to this sub-problem",
          "reasoning_steps": [
            {
              "step_number": 1,
              "description": "What this step accomplishes",
              "method": "REASONING_METHOD",
              "input": "Input for this reasoning step",
              "output": "Output from this reasoning step",
              "confidence": 0.9,
              "justification": "Why this step is valid"
            }
          ]
        }
      ],
      
      "reasoning_path": [
        {
          "step_number": 1,
          "description": "Description of the step",
          "method": "REASONING_METHOD",
          "input": "Input for this reasoning step",
          "output": "Output from this reasoning step",
          "confidence": 0.9,
          "justification": "Why this step is valid"
        }
      ],
      
      "conclusion": "Overall conclusion",
      "recommended_solution": "Detailed recommended solution",
      "alternative_solutions": [
        {
          "description": "Alternative solution approach",
          "pros": ["List of pros"],
          "cons": ["List of cons"],
          "confidence": 0.7
        }
      ],
      
      "confidence_score": 0.85,
      "limitations": ["List any limitations of your solution"],
      "additional_information_needed": ["Optional list of additional information that would help"]
    }
    `;
  }

  /**
   * Gets a description for a reasoning method
   * @param method The reasoning method
   * @returns A description of the method
   */
  private getMethodDescription(method: ReasoningMethod): string {
    const descriptions: Record<ReasoningMethod, string> = {
      [ReasoningMethod.DEDUCTIVE]: 'Reasoning from general principles to specific conclusions',
      [ReasoningMethod.INDUCTIVE]: 'Reasoning from specific observations to general conclusions',
      [ReasoningMethod.ABDUCTIVE]: 'Reasoning to the most likely explanation (inference to the best explanation)',
      [ReasoningMethod.ANALOGICAL]: 'Reasoning by comparing similar situations or problems',
      [ReasoningMethod.CAUSAL]: 'Reasoning about cause and effect relationships',
      [ReasoningMethod.COUNTERFACTUAL]: 'Reasoning about what might have happened under different conditions',
      [ReasoningMethod.BAYESIAN]: 'Reasoning using probability theory to update beliefs based on evidence'
    };
    
    return descriptions[method];
  }

  /**
   * Creates a fallback reasoning result when the LLM response cannot be parsed
   * @param problem The original problem statement
   * @param error The error that occurred
   * @returns A fallback reasoning result
   */
  private createFallbackReasoningResult(problem: string, error: Error): ReasoningResult {
    return {
      problem_statement: problem,
      problem_analysis: 'Unable to perform complete analysis due to processing error',
      assumptions: ['Limited analysis was performed'],
      
      sub_problems: [
        {
          id: 'main',
          description: 'Main problem',
          prerequisites: [],
          solution: 'Could not generate a structured solution due to processing error'
        }
      ],
      
      reasoning_path: [
        {
          step_number: 1,
          description: 'Initial problem assessment',
          method: ReasoningMethod.DEDUCTIVE,
          input: problem,
          output: 'Error occurred during reasoning',
          confidence: 0.1,
          justification: 'Limited processing was completed'
        }
      ],
      
      conclusion: 'Reasoning process encountered an error: ' + error.message,
      recommended_solution: 'Please try again with a more clearly defined problem, or break the problem into smaller parts',
      alternative_solutions: [],
      
      confidence_score: 0,
      limitations: [
        'Reasoning process failed due to an error',
        'No complete solution could be generated',
        error.message
      ]
    };
  }

  /**
   * Formats a reasoning result into a human-readable markdown format
   * @param result The reasoning result to format
   * @returns Formatted markdown string
   */
  private formatReasoningResult(result: ReasoningResult): string {
    // Create markdown output
    let markdown = `# Complex Reasoning Result\n\n`;
    
    // Add problem section
    markdown += `## Problem Statement\n\n${result.problem_statement}\n\n`;
    markdown += `## Problem Analysis\n\n${result.problem_analysis}\n\n`;
    
    // Add assumptions
    if (result.assumptions.length > 0) {
      markdown += `## Assumptions\n\n`;
      for (const assumption of result.assumptions) {
        markdown += `- ${assumption}\n`;
      }
      markdown += '\n';
    }
    
    // Add sub-problems
    if (result.sub_problems.length > 0) {
      markdown += `## Problem Decomposition\n\n`;
      for (const subProblem of result.sub_problems) {
        markdown += `### Sub-Problem: ${subProblem.description}\n\n`;
        
        if (subProblem.prerequisites.length > 0) {
          markdown += `**Prerequisites**: ${subProblem.prerequisites.join(', ')}\n\n`;
        }
        
        if (subProblem.solution) {
          markdown += `**Solution**: ${subProblem.solution}\n\n`;
        }
        
        if (subProblem.reasoning_steps && subProblem.reasoning_steps.length > 0) {
          markdown += `**Reasoning Steps**:\n\n`;
          for (const step of subProblem.reasoning_steps) {
            markdown += `${step.step_number}. **${step.description}** (${step.method}, confidence: ${(step.confidence * 100).toFixed(0)}%)\n`;
            markdown += `   Input: ${step.input}\n`;
            markdown += `   Output: ${step.output}\n`;
            markdown += `   Justification: ${step.justification}\n\n`;
          }
        }
      }
    }
    
    // Add reasoning path
    if (result.reasoning_path.length > 0) {
      markdown += `## Reasoning Process\n\n`;
      for (const step of result.reasoning_path) {
        markdown += `### Step ${step.step_number}: ${step.description}\n\n`;
        markdown += `**Method**: ${step.method}\n\n`;
        markdown += `**Input**: ${step.input}\n\n`;
        markdown += `**Output**: ${step.output}\n\n`;
        markdown += `**Confidence**: ${(step.confidence * 100).toFixed(0)}%\n\n`;
        markdown += `**Justification**: ${step.justification}\n\n`;
      }
    }
    
    // Add conclusions and solutions
    markdown += `## Conclusion\n\n${result.conclusion}\n\n`;
    markdown += `## Recommended Solution\n\n${result.recommended_solution}\n\n`;
    
    // Add alternative solutions
    if (result.alternative_solutions.length > 0) {
      markdown += `## Alternative Solutions\n\n`;
      for (let i = 0; i < result.alternative_solutions.length; i++) {
        const alt = result.alternative_solutions[i];
        markdown += `### Alternative ${i + 1}: ${alt.description}\n\n`;
        
        if (alt.pros.length > 0) {
          markdown += `**Pros**:\n`;
          for (const pro of alt.pros) {
            markdown += `- ${pro}\n`;
          }
          markdown += '\n';
        }
        
        if (alt.cons.length > 0) {
          markdown += `**Cons**:\n`;
          for (const con of alt.cons) {
            markdown += `- ${con}\n`;
          }
          markdown += '\n';
        }
        
        markdown += `**Confidence**: ${(alt.confidence * 100).toFixed(0)}%\n\n`;
      }
    }
    
    // Add meta-reasoning
    markdown += `## Meta-Analysis\n\n`;
    markdown += `**Overall Confidence**: ${(result.confidence_score * 100).toFixed(0)}%\n\n`;
    
    if (result.limitations.length > 0) {
      markdown += `**Limitations**:\n`;
      for (const limitation of result.limitations) {
        markdown += `- ${limitation}\n`;
      }
      markdown += '\n';
    }
    
    if (result.additional_information_needed && result.additional_information_needed.length > 0) {
      markdown += `**Additional Information Needed**:\n`;
      for (const info of result.additional_information_needed) {
        markdown += `- ${info}\n`;
      }
      markdown += '\n';
    }
    
    return markdown;
  }
} 