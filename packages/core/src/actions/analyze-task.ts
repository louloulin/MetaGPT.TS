import { BaseAction } from './base-action';
import type { ActionConfig, ActionOutput } from '../types/action';
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

/**
 * Task analysis result
 */
export interface TaskAnalysis {
  overview: {
    title: string;
    description: string;
    objectives: string[];
    constraints: string[];
    assumptions: string[];
  };
  breakdown: {
    totalSubtasks: number;
    estimatedTotalHours: number;
    criticalPath: string[];
    subtasks: Subtask[];
  };
  dependencies: {
    external: TaskDependency[];
    internal: TaskDependency[];
  };
  risks: {
    high: number;
    medium: number;
    low: number;
    details: {
      risk: string;
      level: TaskRisk;
      impact: string;
      mitigation: string;
    }[];
  };
  recommendations: {
    approach: string[];
    tooling: string[];
    timeline: string[];
    resources: string[];
  };
}

/**
 * Action for analyzing tasks and breaking them down into subtasks
 */
export class AnalyzeTaskAction extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'AnalyzeTask',
      description: config.description || 'Analyze task and provide comprehensive breakdown with dependencies and risks'
    });
  }

  protected async prompt(): Promise<string> {
    // Get and validate required arguments
    const task = this.getArg<string>('task');
    if (!task) {
      throw new Error('No task provided for analysis');
    }

    // Get optional arguments with defaults
    const context = this.getArg<string>('context') || '';
    const constraints = this.getArg<string[]>('constraints') || [];
    const assumptions = this.getArg<string[]>('assumptions') || [];
    const maxDepth = this.getArg<number>('maxDepth') || 3;

    // Log analysis start
    logger.info(`[${this.name}] Starting task analysis`);
    logger.debug(`[${this.name}] Configuration:`, {
      maxDepth,
      hasContext: !!context,
      constraintsCount: constraints.length,
      assumptionsCount: assumptions.length
    });

    return `Please analyze the following task and provide a comprehensive breakdown:

Task:
${task}

${context ? `Context:\n${context}\n\n` : ''}
${constraints.length ? `Constraints:\n${constraints.join('\n')}\n\n` : ''}
${assumptions.length ? `Assumptions:\n${assumptions.join('\n')}\n\n` : ''}

Please provide the analysis in the following JSON format:

{
  "overview": {
    "title": "Task title",
    "description": "Detailed task description",
    "objectives": ["List of main objectives"],
    "constraints": ["List of constraints"],
    "assumptions": ["List of assumptions"]
  },
  "breakdown": {
    "totalSubtasks": 0,
    "estimatedTotalHours": 0,
    "criticalPath": ["List of critical subtask IDs"],
    "subtasks": [
      {
        "id": "Unique subtask ID",
        "name": "Subtask name",
        "description": "Detailed description",
        "complexity": "${Object.values(TaskComplexity).join('" | "')}",
        "priority": "${Object.values(TaskPriority).join('" | "')}",
        "estimatedHours": 0,
        "dependencies": [
          {
            "id": "Dependency ID",
            "name": "Dependency name",
            "type": "hard | soft",
            "description": "Dependency description"
          }
        ],
        "resources": [
          {
            "type": "Resource type",
            "description": "Resource description",
            "quantity": 0,
            "skills": ["Required skills"]
          }
        ],
        "risks": [
          {
            "level": "${Object.values(TaskRisk).join('" | "')}",
            "description": "Risk description",
            "mitigation": "Mitigation strategy"
          }
        ],
        "acceptance": ["Acceptance criteria"]
      }
    ]
  },
  "dependencies": {
    "external": ["List of external dependencies"],
    "internal": ["List of internal dependencies"]
  },
  "risks": {
    "high": 0,
    "medium": 0,
    "low": 0,
    "details": [
      {
        "risk": "Risk description",
        "level": "${Object.values(TaskRisk).join('" | "')}",
        "impact": "Impact description",
        "mitigation": "Mitigation strategy"
      }
    ]
  },
  "recommendations": {
    "approach": ["Recommended approaches"],
    "tooling": ["Recommended tools"],
    "timeline": ["Timeline recommendations"],
    "resources": ["Resource recommendations"]
  }
}

Please ensure:
1. Subtasks are broken down to a maximum depth of ${maxDepth} levels
2. Each subtask has a unique ID
3. Dependencies are clearly identified
4. Resource requirements are specific
5. Risks are properly assessed
6. Time estimates are realistic
7. Critical path is identified
8. Recommendations are practical`;
  }

  /**
   * Parse and validate the task analysis
   * @param response The LLM response
   * @returns Parsed task analysis
   */
  private parseTaskAnalysis(response: string): TaskAnalysis {
    try {
      const result = JSON.parse(response);
      
      // Validate required sections
      if (!result.overview || !result.breakdown || !result.dependencies || !result.risks || !result.recommendations) {
        throw new Error('Missing required sections in analysis');
      }

      // Validate subtasks
      if (!Array.isArray(result.breakdown.subtasks)) {
        throw new Error('Subtasks must be an array');
      }

      // Validate estimates
      if (result.breakdown.estimatedTotalHours < 0) {
        throw new Error('Total estimated hours cannot be negative');
      }

      return result;
    } catch (error) {
      logger.error(`[${this.name}] Failed to parse task analysis:`, error);
      throw new Error(`Failed to parse task analysis: ${error}`);
    }
  }

  /**
   * Format the task analysis as markdown
   * @param analysis The task analysis result
   * @returns Formatted markdown string
   */
  private formatTaskAnalysis(analysis: TaskAnalysis): string {
    return `# Task Analysis Report

## Overview
### ${analysis.overview.title}
${analysis.overview.description}

### Objectives
${analysis.overview.objectives.map(obj => `- ${obj}`).join('\n')}

### Constraints
${analysis.overview.constraints.map(con => `- ${con}`).join('\n')}

### Assumptions
${analysis.overview.assumptions.map(ass => `- ${ass}`).join('\n')}

## Task Breakdown
- Total Subtasks: ${analysis.breakdown.totalSubtasks}
- Estimated Total Hours: ${analysis.breakdown.estimatedTotalHours}
- Critical Path: ${analysis.breakdown.criticalPath.join(' → ')}

### Subtasks
${analysis.breakdown.subtasks.map(subtask => `
#### ${subtask.name} (${subtask.id})
${subtask.description}

- Complexity: ${subtask.complexity}
- Priority: ${subtask.priority}
- Estimated Hours: ${subtask.estimatedHours}

**Dependencies:**
${subtask.dependencies.map(dep => `- ${dep.name} (${dep.type}): ${dep.description}`).join('\n')}

**Resources:**
${subtask.resources.map(res => `- ${res.type}: ${res.description}${res.quantity ? ` (${res.quantity})` : ''}${res.skills?.length ? `\n  Skills: ${res.skills.join(', ')}` : ''}`).join('\n')}

**Risks:**
${subtask.risks.map(risk => `- ${risk.level}: ${risk.description}\n  Mitigation: ${risk.mitigation}`).join('\n')}

**Acceptance Criteria:**
${subtask.acceptance.map(ac => `- ${ac}`).join('\n')}
`).join('\n')}

## Dependencies
### External Dependencies
${analysis.dependencies.external.map(dep => `- ${dep.name}: ${dep.description}`).join('\n')}

### Internal Dependencies
${analysis.dependencies.internal.map(dep => `- ${dep.name}: ${dep.description}`).join('\n')}

## Risk Analysis
- High Risk Items: ${analysis.risks.high}
- Medium Risk Items: ${analysis.risks.medium}
- Low Risk Items: ${analysis.risks.low}

### Detailed Risks
${analysis.risks.details.map(risk => `
#### ${risk.risk} (${risk.level})
- Impact: ${risk.impact}
- Mitigation: ${risk.mitigation}
`).join('\n')}

## Recommendations

### Approach
${analysis.recommendations.approach.map(rec => `- ${rec}`).join('\n')}

### Tooling
${analysis.recommendations.tooling.map(rec => `- ${rec}`).join('\n')}

### Timeline
${analysis.recommendations.timeline.map(rec => `- ${rec}`).join('\n')}

### Resources
${analysis.recommendations.resources.map(rec => `- ${rec}`).join('\n')}

## Quality Checklist
- [x] Task fully analyzed
- [x] Subtasks identified
- [x] Dependencies mapped
- [x] Resources specified
- [x] Risks assessed
- [x] Timeline estimated
- [x] Critical path identified
- [x] Recommendations provided`;
  }

  /**
   * Execute the task analysis action
   * @returns Analysis results with detailed breakdown
   */
  public async run(): Promise<ActionOutput> {
    try {
      // Get prompt
      const prompt = await this.prompt();
      
      // Generate analysis using LLM
      const response = await this.ask(prompt);
      
      // Parse and validate analysis
      const result = this.parseTaskAnalysis(response);
      
      // Format as markdown
      const formattedResult = this.formatTaskAnalysis(result);
      
      return this.createOutput(
        formattedResult,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in task analysis:`, error);
      return this.createOutput(
        `Failed to analyze task: ${error}`,
        'failed'
      );
    }
  }
} 