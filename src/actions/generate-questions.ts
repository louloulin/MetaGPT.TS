/**
 * Generate Questions Action
 * 
 * This action generates relevant questions based on provided text or context.
 * It's useful for creating interview questions, quiz questions, or discussion prompts.
 */

import { z } from 'zod';
import { BaseAction } from './base-action';
import type { ActionConfig, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';
import { stringifyWithCircularRefs } from '../utils/json';
import type { Message } from '../types/message';

/**
 * Schema for the QuestionNode type
 */
export const QuestionNodeSchema = z.object({
  key: z.string(),
  expectedType: z.any().optional(),
  instruction: z.string(),
  example: z.any()
});

export type QuestionNode = z.infer<typeof QuestionNodeSchema>;

/**
 * Action nodes for question generation process
 */
export const CONTENT_ANALYSIS: QuestionNode = {
  key: 'Content Analysis',
  expectedType: z.string(),
  instruction: 'Analyze the provided content to identify key topics, concepts, and ideas that would be valuable to explore through questions.',
  example: 'The content discusses machine learning algorithms, focusing on supervised learning techniques such as decision trees, random forests, and neural networks. It also covers evaluation metrics and model validation approaches.'
};

export const FACTUAL_QUESTIONS: QuestionNode = {
  key: 'Factual Questions',
  expectedType: z.array(z.object({
    question: z.string(),
    difficulty: z.enum(['basic', 'intermediate', 'advanced']),
    answer: z.string().optional()
  })),
  instruction: 'Generate factual questions that test recall and understanding of specific information presented in the content.',
  example: [
    {
      question: 'What are the three main types of supervised learning algorithms mentioned in the content?',
      difficulty: 'basic',
      answer: 'Decision trees, random forests, and neural networks'
    },
    {
      question: 'How do random forests improve upon individual decision trees?',
      difficulty: 'intermediate',
      answer: 'Random forests reduce overfitting by averaging multiple decision trees trained on different subsets of the data and features'
    }
  ]
};

export const CONCEPTUAL_QUESTIONS: QuestionNode = {
  key: 'Conceptual Questions',
  expectedType: z.array(z.object({
    question: z.string(),
    difficulty: z.enum(['basic', 'intermediate', 'advanced']),
    answer: z.string().optional()
  })),
  instruction: 'Generate conceptual questions that explore understanding of broader ideas, principles, and relationships between concepts.',
  example: [
    {
      question: 'How does the bias-variance tradeoff apply to model selection in machine learning?',
      difficulty: 'advanced',
      answer: 'The bias-variance tradeoff involves balancing a model\'s ability to fit training data (low bias) with its ability to generalize to new data (low variance). Simple models may have high bias but low variance, while complex models may have low bias but high variance.'
    }
  ]
};

export const APPLICATION_QUESTIONS: QuestionNode = {
  key: 'Application Questions',
  expectedType: z.array(z.object({
    question: z.string(),
    difficulty: z.enum(['basic', 'intermediate', 'advanced']),
    answer: z.string().optional()
  })),
  instruction: 'Generate questions that ask how concepts and information can be applied to new situations or problems.',
  example: [
    {
      question: 'How would you apply a random forest algorithm to predict customer churn in a subscription business?',
      difficulty: 'intermediate',
      answer: 'I would collect historical customer data including usage patterns, demographics, and previous churn events. I would then train a random forest model using these features, with churned/not-churned as the target variable. The model would identify the most important features for predicting churn, allowing the business to proactively address at-risk customers.'
    }
  ]
};

export const CRITICAL_THINKING_QUESTIONS: QuestionNode = {
  key: 'Critical Thinking Questions',
  expectedType: z.array(z.object({
    question: z.string(),
    difficulty: z.enum(['basic', 'intermediate', 'advanced']),
    answer: z.string().optional()
  })),
  instruction: 'Generate questions that require analysis, evaluation, or synthesis of information. These questions should prompt deeper thinking about implications, limitations, or alternative perspectives.',
  example: [
    {
      question: 'What are the potential ethical concerns with using machine learning algorithms for automated decision-making in healthcare?',
      difficulty: 'advanced',
      answer: 'Ethical concerns include potential bias in training data leading to discriminatory outcomes, lack of transparency in "black box" models making it difficult to explain decisions to patients, questions of accountability when algorithms make mistakes, privacy concerns with sensitive health data, and the risk of overreliance on algorithms at the expense of human judgment and personalized care.'
    }
  ]
};

export const DISCUSSION_PROMPTS: QuestionNode = {
  key: 'Discussion Prompts',
  expectedType: z.array(z.string()),
  instruction: 'Generate open-ended discussion prompts that could facilitate group conversation and explore different perspectives on the content.',
  example: [
    'How might advances in machine learning transform the role of human experts in fields like medicine, law, or education?',
    'Discuss the balance between automation and human judgment in critical decision-making processes.'
  ]
};

export const QUESTION_ORGANIZATION: QuestionNode = {
  key: 'Question Organization',
  expectedType: z.object({
    categories: z.array(z.string()),
    progression: z.string(),
    recommendations: z.array(z.string())
  }),
  instruction: 'Provide a structure for organizing these questions, including logical groupings, suggested sequence, and recommendations for use.',
  example: {
    categories: ['Technical fundamentals', 'Practical applications', 'Ethical considerations', 'Future directions'],
    progression: 'Begin with factual questions to establish baseline knowledge, follow with conceptual questions to deepen understanding, then move to application and critical thinking questions to challenge advanced learners.',
    recommendations: [
      'Use factual questions for quick knowledge checks or quizzes',
      'Use conceptual and application questions for assignments or exams',
      'Use critical thinking questions and discussion prompts for group activities or essays'
    ]
  }
};

export const QUESTION_NODES = [
  CONTENT_ANALYSIS,
  FACTUAL_QUESTIONS,
  CONCEPTUAL_QUESTIONS,
  APPLICATION_QUESTIONS,
  CRITICAL_THINKING_QUESTIONS,
  DISCUSSION_PROMPTS,
  QUESTION_ORGANIZATION
];

/**
 * Configuration for the GenerateQuestions action
 */
export interface GenerateQuestionsConfig extends ActionConfig {
  /**
   * Optional configuration for question generation
   */
  questionConfig?: {
    /**
     * Source content to generate questions about
     */
    content?: string;
    
    /**
     * Target difficulty level(s)
     */
    difficulty?: ('basic' | 'intermediate' | 'advanced')[];
    
    /**
     * Whether to include answers with the questions
     */
    includeAnswers?: boolean;
    
    /**
     * Specific types of questions to generate
     */
    questionTypes?: string[];
    
    /**
     * Number of questions to generate (approximate)
     */
    count?: number;
  };
}

/**
 * GenerateQuestions Action
 * Creates various types of questions based on provided content
 */
export class GenerateQuestions extends BaseAction {
  private nodes: QuestionNode[];
  private questionConfig: {
    content: string;
    difficulty: ('basic' | 'intermediate' | 'advanced')[];
    includeAnswers: boolean;
    questionTypes: string[];
    count: number;
  };

  /**
   * Creates a new GenerateQuestions action
   * 
   * @param config Optional configuration
   */
  constructor(config: GenerateQuestionsConfig) {
    super({
      name: 'GenerateQuestions',
      description: 'Generates relevant questions from provided content',
      prefix: config.prefix,
      args: config.args,
      llm: config.llm,
      memory: config.memory,
      workingMemory: config.workingMemory
    });
    
    this.nodes = QUESTION_NODES;
    this.questionConfig = {
      content: config.questionConfig?.content || '',
      difficulty: config.questionConfig?.difficulty || ['basic', 'intermediate', 'advanced'],
      includeAnswers: config.questionConfig?.includeAnswers !== undefined 
        ? config.questionConfig.includeAnswers 
        : true,
      questionTypes: config.questionConfig?.questionTypes || 
        ['factual', 'conceptual', 'application', 'critical-thinking', 'discussion'],
      count: config.questionConfig?.count || 10
    };
    
    logger.debug(`GenerateQuestions initialized with ${this.nodes.length} nodes`);
  }

  /**
   * Runs the question generation action
   * 
   * @returns Action result with generated questions
   */
  async run(): Promise<ActionOutput> {
    logger.info(`Running GenerateQuestions action`);
    
    try {
      // Determine content from either config or context
      const messageContent = this.context?.args?.message 
        ? (this.context.args.message as Message).content 
        : '';
      const contextContent = this.context?.args?.context?.toString() || '';
      
      // Prioritize config content, then message content, then context content
      const content = this.questionConfig.content || messageContent || contextContent;
      
      if (!content) {
        return this.createOutput(
          'No content provided for question generation. Please provide text content.',
          'failed'
        );
      }
      
      if (!this.llm) {
        return this.createOutput(
          'LLM provider is required for question generation',
          'failed'
        );
      }
      
      const result: Record<string, any> = {};
      
      // Execute each node to build the question generation result
      for (const node of this.nodes) {
        const nodeResult = await this.executeNode(node, content);
        result[node.key] = nodeResult;
      }
      
      // Format the output for better presentation
      const formattedOutput = this.formatQuestions(result);
      
      return this.createOutput(
        formattedOutput,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`Error in GenerateQuestions action: ${error}`);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to generate questions: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Formats the generated questions for better readability
   * 
   * @param result The raw question generation result
   * @returns Formatted question output
   */
  private formatQuestions(result: Record<string, any>): string {
    let output = '# Generated Questions\n\n';
    
    // Add content analysis
    output += `## Content Analysis\n${result['Content Analysis']}\n\n`;
    
    // Add factual questions
    output += '## Factual Questions\n';
    if (Array.isArray(result['Factual Questions'])) {
      result['Factual Questions'].forEach((q: any, i: number) => {
        output += `${i + 1}. **${q.question}** *(${q.difficulty})*\n`;
        if (this.questionConfig.includeAnswers && q.answer) {
          output += `   *Answer: ${q.answer}*\n\n`;
        } else {
          output += '\n';
        }
      });
    }
    
    // Add conceptual questions
    output += '\n## Conceptual Questions\n';
    if (Array.isArray(result['Conceptual Questions'])) {
      result['Conceptual Questions'].forEach((q: any, i: number) => {
        output += `${i + 1}. **${q.question}** *(${q.difficulty})*\n`;
        if (this.questionConfig.includeAnswers && q.answer) {
          output += `   *Answer: ${q.answer}*\n\n`;
        } else {
          output += '\n';
        }
      });
    }
    
    // Add application questions
    output += '\n## Application Questions\n';
    if (Array.isArray(result['Application Questions'])) {
      result['Application Questions'].forEach((q: any, i: number) => {
        output += `${i + 1}. **${q.question}** *(${q.difficulty})*\n`;
        if (this.questionConfig.includeAnswers && q.answer) {
          output += `   *Answer: ${q.answer}*\n\n`;
        } else {
          output += '\n';
        }
      });
    }
    
    // Add critical thinking questions
    output += '\n## Critical Thinking Questions\n';
    if (Array.isArray(result['Critical Thinking Questions'])) {
      result['Critical Thinking Questions'].forEach((q: any, i: number) => {
        output += `${i + 1}. **${q.question}** *(${q.difficulty})*\n`;
        if (this.questionConfig.includeAnswers && q.answer) {
          output += `   *Answer: ${q.answer}*\n\n`;
        } else {
          output += '\n';
        }
      });
    }
    
    // Add discussion prompts
    output += '\n## Discussion Prompts\n';
    if (Array.isArray(result['Discussion Prompts'])) {
      result['Discussion Prompts'].forEach((prompt: string, i: number) => {
        output += `${i + 1}. ${prompt}\n`;
      });
    }
    
    // Add organization recommendations
    output += '\n## Question Organization\n';
    const org = result['Question Organization'];
    if (org) {
      output += '### Categories\n';
      if (Array.isArray(org.categories)) {
        org.categories.forEach((cat: string) => {
          output += `- ${cat}\n`;
        });
      }
      
      output += '\n### Suggested Progression\n';
      output += `${org.progression}\n`;
      
      output += '\n### Recommendations\n';
      if (Array.isArray(org.recommendations)) {
        org.recommendations.forEach((rec: string) => {
          output += `- ${rec}\n`;
        });
      }
    }
    
    return output;
  }

  /**
   * Executes a single question node
   * 
   * @param node The question node to execute
   * @param content The content for which to generate questions
   * @returns The result of the node execution
   */
  private async executeNode(node: QuestionNode, content: string): Promise<any> {
    logger.debug(`Executing question node: ${node.key}`);
    
    const prompt = this.createNodePrompt(node, content);
    const response = await this.llm.generate(prompt);
    
    try {
      // Parse the result based on the expected type
      if (node.key === 'Content Analysis') {
        // Content analysis is a string
        return response;
      } else if (node.key === 'Question Organization') {
        // Question organization is a structured object
        return JSON.parse(response);
      } else {
        // All other nodes are arrays of questions
        return JSON.parse(response);
      }
    } catch (error) {
      logger.error(`Error parsing node ${node.key} result: ${error}`);
      return response; // Return as-is if parsing fails
    }
  }

  /**
   * Creates a prompt for a specific question node
   * 
   * @param node The question node
   * @param content The content for which to generate questions
   * @returns The formatted prompt
   */
  private createNodePrompt(node: QuestionNode, content: string): string {
    // Base prompt template
    let prompt = `
You are an expert educator and question designer tasked with generating high-quality questions about provided content.

${node.instruction}

CONTENT TO ANALYZE:
${content.length > 8000 ? content.substring(0, 8000) + "... (content truncated)" : content}

CONFIGURATION:
- Difficulty levels: ${this.questionConfig.difficulty.join(', ')}
- Include answers: ${this.questionConfig.includeAnswers ? 'Yes' : 'No'}
- Approximate number of questions requested: ${this.questionConfig.count}
- Question types: ${this.questionConfig.questionTypes.join(', ')}
`;

    // Add example format
    prompt += `\nProvide your response in the expected format. For reference, here's an example: ${stringifyWithCircularRefs(node.example, 2)}`;

    // Add node-specific instructions
    if (node.key === 'Factual Questions') {
      prompt += `\n\nGenerate approximately ${Math.ceil(this.questionConfig.count / 4)} factual questions that directly test knowledge from the content.`;
    } else if (node.key === 'Conceptual Questions') {
      prompt += `\n\nGenerate approximately ${Math.ceil(this.questionConfig.count / 4)} conceptual questions that test deeper understanding of the content.`;
    } else if (node.key === 'Application Questions') {
      prompt += `\n\nGenerate approximately ${Math.ceil(this.questionConfig.count / 4)} application questions that test ability to apply concepts from the content.`;
    } else if (node.key === 'Critical Thinking Questions') {
      prompt += `\n\nGenerate approximately ${Math.ceil(this.questionConfig.count / 4)} critical thinking questions that challenge analytical skills based on the content.`;
    } else if (node.key === 'Discussion Prompts') {
      prompt += `\n\nGenerate approximately ${Math.ceil(this.questionConfig.count / 5)} discussion prompts that would facilitate group conversation about the content.`;
    }

    return prompt;
  }
} 