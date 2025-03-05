import { BaseAction } from './base-action';
import type { ActionConfig, ActionOutput } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Map Components Action
 * Maps relationships between system components and generates component diagrams
 */
export class MapComponents extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'MapComponents',
      description: config.description || 'Map relationships between system components and generate component diagrams',
    });
  }

  /**
   * Execute the component mapping action
   * @returns The component relationship map as action output
   */
  async run(): Promise<ActionOutput> {
    logger.info(`[${this.name}] Running component mapping`);
    
    // Get components list from args
    const components = this.getArg<string>('components') || '';
    
    if (!components) {
      return this.createOutput(
        'No components provided for relationship mapping',
        'failed'
      );
    }

    if (!this.llm) {
      return this.createOutput(
        'LLM provider is required for component mapping',
        'failed'
      );
    }

    try {
      const prompt = this.createMappingPrompt(components);
      const mapping = await this.llm.chat(prompt);

      return this.createOutput(
        mapping,
        'completed'
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in component mapping:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to map component relationships: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Create a prompt for component relationship mapping
   * @param components - The components to map
   * @returns The formatted prompt
   */
  private createMappingPrompt(components: string): string {
    return `
    As a software architect, map the relationships between these system components:
    
    COMPONENTS:
    ${components}
    
    Please provide:
    
    1. Component Diagram
       - Create a component diagram in mermaid.js format
       - Show all major components and their connections
       - Include direction of dependencies
       - Label interfaces and important relationships
    
    2. Relationship Details
       - For each relationship between components:
         * Describe the nature of the relationship
         * Specify data/control flow direction
         * Explain why the relationship exists
    
    3. Dependency Analysis
       - Identify key dependencies between components
       - Highlight any circular dependencies
       - Suggest ways to reduce tight coupling
    
    4. Interface Specifications
       - For each major component interface:
         * Describe its purpose
         * List key methods/endpoints
         * Specify data formats exchanged
    
    5. Deployment Considerations
       - Group components that should be deployed together
       - Identify network boundaries between components
       - Suggest optimal component distribution
    
    Format your response as a detailed document with clear sections. Use markdown for readability.
    For the component diagram, use mermaid.js syntax (which uses markdown code blocks with 'mermaid' type).
    
    Example mermaid component diagram format:
    \`\`\`mermaid
    graph TD
      A[Component A] --> B[Component B]
      B --> C[Component C]
      A --> C
    \`\`\`
    `;
  }
} 