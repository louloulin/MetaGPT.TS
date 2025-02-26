import { BaseAction } from './base-action';
import type { ActionConfig, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Design Architecture Action
 * Creates a comprehensive software architecture design based on requirements
 */
export class DesignArchitecture extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'DesignArchitecture',
      description: config.description || 'Design software architecture including components, APIs, data structures, and system relationships',
    });
  }

  /**
   * Execute the architecture design action
   * @returns The architecture design as action output
   */
  async run(): Promise<ActionOutput> {
    logger.info(`[${this.name}] Running architecture design`);
    
    // Get requirements from args or context
    const requirements = this.getArg<string>('requirements') || '';
    
    if (!requirements) {
      return this.createOutput(
        'No requirements provided for architecture design',
        'failed'
      );
    }

    if (!this.llm) {
      return this.createOutput(
        'LLM provider is required for architecture design',
        'failed'
      );
    }

    try {
      const prompt = this.createDesignPrompt(requirements);
      const design = await this.llm.chat(prompt);

      return this.createOutput(
        design,
        'completed'
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in design architecture:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to design architecture: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Create a prompt for architecture design based on requirements
   * @param requirements - The requirements to base the architecture on
   * @returns The formatted prompt
   */
  private createDesignPrompt(requirements: string): string {
    return `
    As a software architect, design a comprehensive system architecture for the following requirements:
    
    REQUIREMENTS:
    ${requirements}
    
    Your architecture design should include:
    
    1. System Overview
       - High-level description of the system
       - Main components and their purpose
       - Architectural patterns and styles used
    
    2. Component Diagram
       - Main components/services
       - Relationships between components
       - External systems and integrations
    
    3. API Design
       - Key endpoints and their purpose
       - Request/response formats
       - Authentication and authorization mechanisms
    
    4. Data Model
       - Key entities and their attributes
       - Relationships between entities
       - Database schema recommendations
    
    5. Technology Stack
       - Recommended technologies for each component
       - Justification for technology choices
       - Third-party libraries and frameworks
    
    6. Non-Functional Requirements
       - Scalability considerations
       - Security measures
       - Performance optimizations
       - Resilience and fault tolerance strategies
    
    7. Deployment Architecture
       - Deployment environments
       - Infrastructure recommendations
       - CI/CD pipeline suggestions
    
    Format your response as a detailed architecture document with clear sections. Use markdown for readability.
    For any diagrams, describe them in text (using markdown or mermaid syntax if applicable).
    `;
  }
} 