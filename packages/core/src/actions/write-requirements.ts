/**
 * WriteRequirements Action
 * 
 * This action generates detailed requirements documents for software projects,
 * including functional requirements, non-functional requirements, constraints,
 * and acceptance criteria.
 */

import { BaseAction } from './base-action';
import type { StreamActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

export enum RequirementType {
  FUNCTIONAL = 'FUNCTIONAL',
  NON_FUNCTIONAL = 'NON_FUNCTIONAL',
  TECHNICAL = 'TECHNICAL',
  BUSINESS = 'BUSINESS',
  SECURITY = 'SECURITY',
  PERFORMANCE = 'PERFORMANCE'
}

export enum RequirementPriority {
  MUST_HAVE = 'MUST_HAVE',
  SHOULD_HAVE = 'SHOULD_HAVE',
  COULD_HAVE = 'COULD_HAVE',
  WONT_HAVE = 'WONT_HAVE'
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  type: RequirementType;
  priority: RequirementPriority;
  acceptance_criteria: string[];
  dependencies?: string[];
  stakeholders?: string[];
  estimated_effort?: string;
  notes?: string;
}

export interface RequirementsDocument {
  project_name: string;
  version: string;
  last_updated: string;
  executive_summary: string;
  scope: {
    included: string[];
    excluded: string[];
  };
  assumptions: string[];
  constraints: string[];
  requirements: Requirement[];
  risks: {
    description: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    mitigation: string;
  }[];
}

export interface WriteRequirementsArgs {
  project_name: string;
  scope_focus?: string[];
  stakeholders?: string[];
  include_technical?: boolean;
  include_security?: boolean;
  include_performance?: boolean;
}

export class WriteRequirements extends BaseAction {
  protected args: WriteRequirementsArgs;

  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'WriteRequirements',
      description: config.description || 'Generates detailed requirements documents'
    });
    
    this.args = {
      project_name: config.args?.project_name || 'Untitled Project',
      scope_focus: config.args?.scope_focus || [],
      stakeholders: config.args?.stakeholders || [],
      include_technical: config.args?.include_technical ?? true,
      include_security: config.args?.include_security ?? true,
      include_performance: config.args?.include_performance ?? true
    };
  }

  protected async prompt(): Promise<string> {
    // Get messages from args
    const messages = this.getArg<any[]>('messages') || [];
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('No messages available for requirements generation');
    }
    
    return this.preparePrompt(messages);
  }

  public async run(): Promise<StreamActionOutput> {
    try {
      // Generate requirements based on prompt
      let doc: RequirementsDocument;
      
      try {
        const response = await this.ask(await this.prompt());
        doc = JSON.parse(response);
        doc = {
          project_name: doc.project_name || this.args.project_name || 'Untitled Project',
          version: doc.version || '1.0.0',
          last_updated: doc.last_updated || new Date().toISOString(),
          executive_summary: doc.executive_summary || 'Basic project description',
          scope: {
            included: doc.scope?.included || [],
            excluded: doc.scope?.excluded || []
          },
          assumptions: doc.assumptions || [],
          constraints: doc.constraints || [],
          requirements: (doc.requirements || []).map((req: any, index: number) => ({
            ...req,
            id: req.id || this.generateRequirementId(req.type || RequirementType.FUNCTIONAL, index)
          })),
          risks: doc.risks || []
        };
      } catch (error) {
        logger.error('Error generating requirements:', error);
        doc = this.createFallbackDocument(await this.prompt());
      }

      // Format the document
      const formattedDoc = this.formatRequirementsDocument(doc);

      return this.createOutput(formattedDoc, 'completed');
    } catch (error) {
      logger.error('Error in WriteRequirements:', error);
      return this.handleException(error as Error);
    }
  }

  private generateRequirementId(type: RequirementType, index: number): string {
    const prefix = type.substring(0, 3).toUpperCase();
    return `${prefix}-${String(index + 1).padStart(3, '0')}`;
  }

  private preparePrompt(messages: any[]): string {
    // Ensure we have a messages array to work with
    if (!Array.isArray(messages)) {
      logger.warn('Messages is not an array, using empty array instead');
      messages = [];
    }
    
    const messageContent = messages.map(m => m.content).join('\n');
    return `Generate requirements document for the following project information:\n\n${messageContent}`;
  }

  private createFallbackDocument(prompt: string): RequirementsDocument {
    return {
      project_name: this.args.project_name || 'Test Project',
      version: '1.0.0',
      last_updated: new Date().toISOString(),
      executive_summary: `Basic requirements document for: ${prompt}`,
      scope: {
        included: ['Basic functionality'],
        excluded: ['Advanced features']
      },
      assumptions: ['Standard development environment'],
      constraints: ['Time and resource limitations'],
      requirements: [
        {
          id: this.generateRequirementId(RequirementType.FUNCTIONAL, 0),
          title: 'Basic Functionality',
          description: 'Implement core functionality as described in prompt',
          type: RequirementType.FUNCTIONAL,
          priority: RequirementPriority.MUST_HAVE,
          acceptance_criteria: ['System performs basic operations']
        }
      ],
      risks: [
        {
          description: 'Requirements may be incomplete',
          impact: 'MEDIUM',
          mitigation: 'Regular review and updates'
        }
      ]
    };
  }

  private formatRequirementsDocument(doc: RequirementsDocument): string {
    let output = `# ${doc.project_name} Requirements Document\n`;
    output += `Version: ${doc.version}\n`;
    output += `Last Updated: ${doc.last_updated}\n\n`;

    output += `## Executive Summary\n${doc.executive_summary}\n\n`;

    output += '## Project Scope\n\n';
    output += '### Included\n';
    doc.scope.included.forEach(item => {
      output += `- ${item}\n`;
    });
    output += '\n### Excluded\n';
    doc.scope.excluded.forEach(item => {
      output += `- ${item}\n`;
    });
    output += '\n';

    output += '## Assumptions\n';
    doc.assumptions.forEach(assumption => {
      output += `- ${assumption}\n`;
    });
    output += '\n';

    output += '## Constraints\n';
    doc.constraints.forEach(constraint => {
      output += `- ${constraint}\n`;
    });
    output += '\n';

    output += '## Requirements\n\n';
    doc.requirements.forEach(req => {
      output += `### ${req.id}: ${req.title}\n`;
      output += `**Type:** ${req.type}\n`;
      output += `**Priority:** ${req.priority}\n\n`;
      output += `${req.description}\n\n`;
      
      output += '**Acceptance Criteria:**\n';
      req.acceptance_criteria.forEach(criteria => {
        output += `- ${criteria}\n`;
      });
      output += '\n';

      if (req.stakeholders && req.stakeholders.length > 0) {
        output += '**Stakeholders:**\n';
        req.stakeholders.forEach(stakeholder => {
          output += `- ${stakeholder}\n`;
        });
        output += '\n';
      }

      if (req.dependencies && req.dependencies.length > 0) {
        output += '**Dependencies:**\n';
        req.dependencies.forEach(dep => {
          output += `- ${dep}\n`;
        });
        output += '\n';
      }

      if (req.estimated_effort) {
        output += `**Estimated Effort:** ${req.estimated_effort}\n\n`;
      }

      if (req.notes) {
        output += `**Notes:** ${req.notes}\n\n`;
      }
    });

    if (doc.risks.length > 0) {
      output += '## Risks and Mitigations\n\n';
      doc.risks.forEach(risk => {
        output += `### Risk: ${risk.description}\n`;
        output += `Impact: ${risk.impact}\n`;
        output += `**Mitigation:** ${risk.mitigation}\n\n`;
      });
    }

    return output;
  }
} 