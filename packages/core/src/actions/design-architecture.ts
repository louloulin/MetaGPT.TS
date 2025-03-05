import { BaseAction } from './base-action';
import type { StreamActionOutput as ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Architecture component type
 */
export interface ArchitectureComponent {
  name: string;
  description: string;
  responsibilities: string[];
  dependencies: string[];
  apis: {
    name: string;
    method: string;
    endpoint: string;
    description: string;
    parameters?: Record<string, string>;
    response?: Record<string, string>;
  }[];
  dataModel?: {
    name: string;
    fields: Record<string, string>;
    relationships?: Record<string, string>;
  }[];
}

/**
 * Architecture design result interface
 */
export interface ArchitectureDesign {
  overview: {
    description: string;
    goals: string[];
    constraints: string[];
    assumptions: string[];
  };
  components: ArchitectureComponent[];
  dataFlow: {
    source: string;
    target: string;
    description: string;
    dataType: string;
    protocol?: string;
  }[];
  technologyStack: {
    category: string;
    technologies: {
      name: string;
      version?: string;
      purpose: string;
    }[];
  }[];
  security: {
    concerns: {
      area: string;
      description: string;
      mitigation: string;
      priority: 'high' | 'medium' | 'low';
    }[];
    recommendations: string[];
  };
  scalability: {
    approach: string[];
    bottlenecks: {
      component: string;
      description: string;
      solution: string;
    }[];
    recommendations: string[];
  };
  deployment: {
    environment: string;
    requirements: string[];
    steps: string[];
    monitoring: string[];
  };
}

/**
 * Action for designing system architecture
 */
export class DesignArchitecture extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'DesignArchitecture',
      description: config.description || 'Design system architecture based on requirements'
    });
  }

  protected async prompt(): Promise<string> {
    // Get and validate required arguments
    const requirements = this.getArg<string>('requirements');
    if (!requirements) {
      throw new Error('No requirements provided for architecture design');
    }

    // Get optional arguments with defaults
    const context = this.getArg<string>('context') || '';
    const constraints = this.getArg<string[]>('constraints') || [];
    const focus = this.getArg<string[]>('focus') || [];

    // Log design start
    logger.info(`[${this.name}] Starting architecture design`);
    logger.debug(`[${this.name}] Configuration:`, {
      hasContext: !!context,
      constraintsCount: constraints.length,
      focusAreas: focus
    });

    return `Based on the following requirements, design a comprehensive system architecture:

Requirements:
${requirements}

${context ? `Context:\n${context}\n\n` : ''}
${constraints.length ? `Constraints:\n${constraints.join('\n')}\n\n` : ''}
${focus.length ? `Focus Areas:\n${focus.join('\n')}\n\n` : ''}

Please provide the architecture design in the following JSON format:

{
  "overview": {
    "description": "High-level system description",
    "goals": ["List of architectural goals"],
    "constraints": ["List of constraints"],
    "assumptions": ["List of assumptions"]
  },
  "components": [
    {
      "name": "Component name",
      "description": "Component description",
      "responsibilities": ["List of responsibilities"],
      "dependencies": ["List of dependencies"],
      "apis": [
        {
          "name": "API name",
          "method": "HTTP method",
          "endpoint": "API endpoint",
          "description": "API description",
          "parameters": {
            "paramName": "param type and description"
          },
          "response": {
            "fieldName": "field type and description"
          }
        }
      ],
      "dataModel": [
        {
          "name": "Model name",
          "fields": {
            "fieldName": "field type and description"
          },
          "relationships": {
            "relationName": "relationship description"
          }
        }
      ]
    }
  ],
  "dataFlow": [
    {
      "source": "Source component",
      "target": "Target component",
      "description": "Flow description",
      "dataType": "Type of data",
      "protocol": "Communication protocol"
    }
  ],
  "technologyStack": [
    {
      "category": "Technology category",
      "technologies": [
        {
          "name": "Technology name",
          "version": "Version number",
          "purpose": "Purpose description"
        }
      ]
    }
  ],
  "security": {
    "concerns": [
      {
        "area": "Security area",
        "description": "Concern description",
        "mitigation": "Mitigation strategy",
        "priority": "high | medium | low"
      }
    ],
    "recommendations": ["Security recommendations"]
  },
  "scalability": {
    "approach": ["Scalability approaches"],
    "bottlenecks": [
      {
        "component": "Component name",
        "description": "Bottleneck description",
        "solution": "Solution approach"
      }
    ],
    "recommendations": ["Scalability recommendations"]
  },
  "deployment": {
    "environment": "Deployment environment",
    "requirements": ["Deployment requirements"],
    "steps": ["Deployment steps"],
    "monitoring": ["Monitoring approaches"]
  }
}

Please ensure:
1. All components are well-defined with clear responsibilities
2. APIs are RESTful and follow best practices
3. Data models include proper relationships
4. Security concerns are properly addressed
5. Scalability approaches are practical
6. Deployment strategy is comprehensive
7. All sections are properly filled out with realistic values`;
  }

  /**
   * Parse and validate the architecture design
   * @param response The LLM response
   * @returns Parsed architecture design
   */
  private parseArchitectureDesign(response: string): ArchitectureDesign {
    try {
      const result = JSON.parse(response);
      
      // Validate required sections
      if (!result.overview || !result.components || !result.dataFlow || 
          !result.technologyStack || !result.security || !result.scalability || 
          !result.deployment) {
        throw new Error('Missing required sections in architecture design');
      }

      // Validate components
      if (!Array.isArray(result.components) || result.components.length === 0) {
        throw new Error('Components must be a non-empty array');
      }

      return result;
    } catch (error) {
      logger.error(`[${this.name}] Failed to parse architecture design:`, error);
      throw new Error(`Failed to parse architecture design: ${error}`);
    }
  }

  /**
   * Format the architecture design as markdown
   * @param design The architecture design
   * @returns Formatted markdown string
   */
  private formatArchitectureDesign(design: ArchitectureDesign): string {
    return `# System Architecture Design

## Overview
${design.overview.description}

### Goals
${design.overview.goals.map(goal => `- ${goal}`).join('\n')}

### Constraints
${design.overview.constraints.map(constraint => `- ${constraint}`).join('\n')}

### Assumptions
${design.overview.assumptions.map(assumption => `- ${assumption}`).join('\n')}

## System Components
${design.components.map(component => `
### ${component.name}
${component.description}

**Responsibilities:**
${component.responsibilities.map(r => `- ${r}`).join('\n')}

**Dependencies:**
${component.dependencies.map(d => `- ${d}`).join('\n')}

**APIs:**
${component.apis.map(api => `
#### ${api.name}
- Method: ${api.method}
- Endpoint: \`${api.endpoint}\`
- Description: ${api.description}
${api.parameters ? `
**Parameters:**
\`\`\`json
${JSON.stringify(api.parameters, null, 2)}
\`\`\`
` : ''}
${api.response ? `
**Response:**
\`\`\`json
${JSON.stringify(api.response, null, 2)}
\`\`\`
` : ''}`).join('\n')}

${component.dataModel ? `
**Data Models:**
${component.dataModel.map(model => `
#### ${model.name}
\`\`\`json
${JSON.stringify({
  fields: model.fields,
  relationships: model.relationships
}, null, 2)}
\`\`\`
`).join('\n')}` : ''}`).join('\n')}

## Data Flow
${design.dataFlow.map(flow => `
### ${flow.source} → ${flow.target}
- Description: ${flow.description}
- Data Type: ${flow.dataType}
${flow.protocol ? `- Protocol: ${flow.protocol}` : ''}`).join('\n')}

## Technology Stack
${design.technologyStack.map(category => `
### ${category.category}
${category.technologies.map(tech => `- ${tech.name}${tech.version ? ` (${tech.version})` : ''}: ${tech.purpose}`).join('\n')}`).join('\n')}

## Security Considerations

### Security Concerns
${design.security.concerns.map(concern => `
#### ${concern.area} (${concern.priority})
- Description: ${concern.description}
- Mitigation: ${concern.mitigation}`).join('\n')}

### Security Recommendations
${design.security.recommendations.map(rec => `- ${rec}`).join('\n')}

## Scalability Strategy

### Approach
${design.scalability.approach.map(a => `- ${a}`).join('\n')}

### Potential Bottlenecks
${design.scalability.bottlenecks.map(bottleneck => `
#### ${bottleneck.component}
- Description: ${bottleneck.description}
- Solution: ${bottleneck.solution}`).join('\n')}

### Scalability Recommendations
${design.scalability.recommendations.map(rec => `- ${rec}`).join('\n')}

## Deployment Strategy

### Environment
${design.deployment.environment}

### Requirements
${design.deployment.requirements.map(req => `- ${req}`).join('\n')}

### Deployment Steps
${design.deployment.steps.map(step => `- ${step}`).join('\n')}

### Monitoring
${design.deployment.monitoring.map(item => `- ${item}`).join('\n')}

## Quality Checklist
- [x] Components defined with clear responsibilities
- [x] APIs documented with proper specifications
- [x] Data models and relationships specified
- [x] Data flow paths identified
- [x] Technology stack selected with justification
- [x] Security concerns addressed
- [x] Scalability strategy defined
- [x] Deployment approach documented`;
  }

  /**
   * Execute the design architecture action
   * @returns Architecture design with detailed breakdown
   */
  public async run(): Promise<ActionOutput> {
    try {
      // Get prompt
      const prompt = await this.prompt();
      
      // Generate design using LLM
      const response = await this.ask(prompt);
      
      // Parse and validate design
      const result = this.parseArchitectureDesign(response);
      
      // Format as markdown
      const formattedResult = this.formatArchitectureDesign(result);
      
      return this.createOutput(
        formattedResult,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in architecture design:`, error);
      return this.createOutput(
        `Failed to design architecture: ${error}`,
        'failed'
      );
    }
  }
}