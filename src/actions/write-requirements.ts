/**
 * WriteRequirements Action
 * 
 * This action generates detailed requirements documents for software projects,
 * including functional requirements, non-functional requirements, constraints,
 * and acceptance criteria.
 */

import { BaseAction } from './base-action';
import type { ActionOutput } from '../types/action';
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
  project_name?: string;
  scope_focus?: string[];
  stakeholders?: string[];
  include_technical?: boolean;
  include_security?: boolean;
  include_performance?: boolean;
}

export class WriteRequirements extends BaseAction {
  protected args: WriteRequirementsArgs;

  constructor(config: any) {
    super({
      name: 'WriteRequirements',
      ...config,
    });
    this.args = config.args || {};
  }

  private generateRequirementId(type: RequirementType, index: number): string {
    const prefix = type.substring(0, 3).toUpperCase();
    return `${prefix}-${String(index).padStart(3, '0')}`;
  }

  private async generateRequirements(prompt: string): Promise<RequirementsDocument> {
    logger.debug('[WriteRequirements] Generating requirements for:', prompt);

    const systemPrompt = `You are a requirements engineering expert. Create a comprehensive requirements document for the given project.
The document should include:
1. Executive summary
2. Project scope
3. Detailed requirements (functional and non-functional)
4. Acceptance criteria
5. Dependencies and constraints
6. Risk assessment

Provide your analysis in a structured JSON format matching the RequirementsDocument interface.`;

    try {
      const response = await this.llm.chat(systemPrompt + "\n\nProject description: " + prompt);
      const document = JSON.parse(response);

      // Ensure requirements have proper IDs
      document.requirements = document.requirements.map((req: Requirement, index: number) => ({
        ...req,
        id: this.generateRequirementId(req.type, index + 1)
      }));

      return {
        project_name: document.project_name || this.args.project_name || 'Untitled Project',
        version: document.version || '1.0.0',
        last_updated: document.last_updated || new Date().toISOString(),
        executive_summary: document.executive_summary || '',
        scope: document.scope || { included: [], excluded: [] },
        assumptions: document.assumptions || [],
        constraints: document.constraints || [],
        requirements: document.requirements || [],
        risks: document.risks || []
      };
    } catch (error) {
      logger.error('[WriteRequirements] Error generating requirements:', error);
      return this.createFallbackDocument(prompt);
    }
  }

  private createFallbackDocument(prompt: string): RequirementsDocument {
    return {
      project_name: this.args.project_name || 'Untitled Project',
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
          id: 'FUN-001',
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
    return `# ${doc.project_name} Requirements Document
Version: ${doc.version}
Last Updated: ${doc.last_updated}

## Executive Summary
${doc.executive_summary}

## Project Scope

### Included
${doc.scope.included.map(item => `- ${item}`).join('\n')}

### Excluded
${doc.scope.excluded.map(item => `- ${item}`).join('\n')}

## Assumptions
${doc.assumptions.map(assumption => `- ${assumption}`).join('\n')}

## Constraints
${doc.constraints.map(constraint => `- ${constraint}`).join('\n')}

## Requirements

${doc.requirements.map(req => `### ${req.id}: ${req.title}
**Type:** ${req.type}
**Priority:** ${req.priority}

${req.description}

**Acceptance Criteria:**
${req.acceptance_criteria.map(criteria => `- ${criteria}`).join('\n')}

${req.dependencies ? `**Dependencies:**\n${req.dependencies.map(dep => `- ${dep}`).join('\n')}\n` : ''}
${req.stakeholders ? `**Stakeholders:**\n${req.stakeholders.map(stakeholder => `- ${stakeholder}`).join('\n')}\n` : ''}
${req.estimated_effort ? `**Estimated Effort:** ${req.estimated_effort}\n` : ''}
${req.notes ? `**Notes:** ${req.notes}` : ''}`).join('\n\n')}

## Risks and Mitigations

${doc.risks.map(risk => `### Risk: ${risk.description}
**Impact:** ${risk.impact}
**Mitigation:** ${risk.mitigation}`).join('\n\n')}`;
  }

  public async run(): Promise<ActionOutput> {
    const messages = this.context.memory.getMessages();
    if (messages.length === 0) {
      return {
        status: 'failed',
        content: 'No messages available for requirements generation'
      };
    }

    const lastMessage = messages[messages.length - 1];
    const document = await this.generateRequirements(lastMessage.content);
    const formattedDocument = this.formatRequirementsDocument(document);

    return {
      status: 'completed',
      content: formattedDocument
    };
  }
} 