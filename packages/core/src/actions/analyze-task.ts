import { BaseAction } from './base-action';
import type { StreamActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Task complexity levels
 */
export enum TaskComplexity {
  TRIVIAL = 'trivial',
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  VERY_COMPLEX = 'very_complex'
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Task risk levels
 */
export enum TaskRisk {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Task dependency type
 */
export interface TaskDependency {
  id: string;
  name: string;
  type: 'hard' | 'soft';
  description: string;
}

/**
 * Task resource requirement
 */
export interface TaskResource {
  type: string;
  description: string;
  quantity?: number;
  skills?: string[];
}

/**
 * Subtask interface
 */
export interface Subtask {
  id: string;
  name: string;
  description: string;
  complexity: TaskComplexity;
  priority: TaskPriority;
  estimatedHours: number;
  dependencies: TaskDependency[];
  resources: TaskResource[];
  risks: {
    level: TaskRisk;
    description: string;
    mitigation: string;
  }[];
  acceptance: string[];
}

export interface AnalyzeTaskConfig extends ActionConfig {
  analysisType?: 'basic' | 'detailed' | 'comprehensive';
  includeTimeline?: boolean;
  includeRisks?: boolean;
  includeDependencies?: boolean;
}

/**
 * Task analysis result
 */
export interface TaskAnalysis {
  title: string;
  description: string;
  objectives: string[];
  requirements: {
    functional: string[];
    technical: string[];
    resources: string[];
  };
  timeline?: {
    estimatedDuration: string;
    milestones: {
      name: string;
      description: string;
      duration: string;
      dependencies?: string[];
    }[];
  };
  risks?: {
    technical: {
      description: string;
      impact: string;
      mitigation: string;
    }[];
    operational: {
      description: string;
      impact: string;
      mitigation: string;
    }[];
  };
  dependencies?: {
    internal: string[];
    external: string[];
    tools: string[];
  };
}

/**
 * Action for analyzing tasks and breaking them down into manageable components
 */
export class AnalyzeTask extends BaseAction {
  private analysisType: 'basic' | 'detailed' | 'comprehensive';
  private includeTimeline: boolean;
  private includeRisks: boolean;
  private includeDependencies: boolean;

  constructor(config: AnalyzeTaskConfig) {
    super({
      ...config,
      name: config.name || 'AnalyzeTask',
      description: config.description || 'Analyze tasks and break them down into manageable components'
    });

    this.analysisType = config.analysisType || 'comprehensive';
    this.includeTimeline = config.includeTimeline ?? true;
    this.includeRisks = config.includeRisks ?? true;
    this.includeDependencies = config.includeDependencies ?? true;
  }

  protected async prompt(): Promise<string> {
    const task = this.getArg<string>('task');
    const context = this.getArg<string>('context') || '';
    const constraints = this.getArg<string[]>('constraints') || [];

    if (!task) {
      throw new Error('No task provided for analysis');
    }

    return `As a project analysis expert, analyze the following task with ${this.analysisType} detail:

Task: ${task}

${context ? `Context:\n${context}\n\n` : ''}
${constraints.length ? `Constraints:\n${constraints.map(c => `- ${c}`).join('\n')}\n\n` : ''}

Please provide a comprehensive analysis including:
1. Task overview and objectives
2. Functional and technical requirements
3. Required resources and skills
${this.includeTimeline ? '4. Timeline and milestones' : ''}
${this.includeRisks ? '5. Risk assessment and mitigation strategies' : ''}
${this.includeDependencies ? '6. Dependencies and prerequisites' : ''}

Focus on:
- Clear breakdown of components
- Realistic resource estimation
- Potential challenges and solutions
- Critical path identification
- Quality requirements
- Success criteria`;
  }

  public async run(): Promise<StreamActionOutput> {
    try {
      const task = this.getArg<string>('task');
      if (!task) {
        return {
          content: 'No task provided for analysis',
          status: 'failed'
        };
      }

      const response = await this.ask(await this.prompt());
      
      return {
        content: response,
        status: 'completed',
        metadata: {
          analysisType: this.analysisType,
          includeTimeline: this.includeTimeline,
          includeRisks: this.includeRisks,
          includeDependencies: this.includeDependencies
        }
      };
    } catch (error: unknown) {
      logger.error('[AnalyzeTask] Error:', error);
      return {
        content: `Failed to analyze task: ${error instanceof Error ? error.message : String(error)}`,
        status: 'failed'
      };
    }
  }
} 