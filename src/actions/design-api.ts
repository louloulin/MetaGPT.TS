/**
 * Design API Action
 * 
 * This action designs APIs, data structures, and system processes based on product requirements.
 * It's responsible for creating comprehensive API designs including endpoints, data models, 
 * and sequence diagrams.
 */

import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Node types for the design API
 */
export enum DesignNodeType {
  IMPLEMENTATION_APPROACH = 'Implementation approach',
  FILE_LIST = 'File list',
  DATA_STRUCTURES_AND_INTERFACES = 'Data structures and interfaces',
  PROGRAM_CALL_FLOW = 'Program call flow',
  ANYTHING_UNCLEAR = 'Anything UNCLEAR',
  
  // Refined node types
  REFINED_IMPLEMENTATION_APPROACH = 'Refined Implementation Approach',
  REFINED_FILE_LIST = 'Refined File list',
  REFINED_DATA_STRUCTURES_AND_INTERFACES = 'Refined Data structures and interfaces',
  REFINED_PROGRAM_CALL_FLOW = 'Refined Program call flow'
}

/**
 * Design API action that creates comprehensive API designs
 */
export class DesignAPI extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'DesignAPI',
      description: config.description || 'Design APIs, data structures, library tables, processes, and paths based on requirements',
    });
  }

  /**
   * Execute the API design action
   * @returns The API design as action output
   */
  async run(): Promise<ActionOutput> {
    logger.info(`[${this.name}] Running API design`);
    
    // Get requirements from args or context
    const requirements = this.getArg<string>('requirements') || '';
    const existingDesign = this.getArg<string>('existing_design') || '';
    const workdir = this.getArg<string>('workdir') || './output';
    
    if (!requirements) {
      return this.createOutput(
        'No requirements provided for API design',
        'failed'
      );
    }

    if (!this.llm) {
      return this.createOutput(
        'LLM provider is required for API design',
        'failed'
      );
    }

    try {
      let design: string;
      
      if (existingDesign) {
        // If existing design exists, refine it
        logger.info(`[${this.name}] Refining existing API design`);
        const prompt = this.createRefinementPrompt(requirements, existingDesign);
        design = await this.llm.chat(prompt);
      } else {
        // Create new design
        logger.info(`[${this.name}] Creating new API design`);
        const prompt = this.createDesignPrompt(requirements);
        design = await this.llm.chat(prompt);
      }

      // Save the design diagrams if possible
      try {
        await this.saveDesignDiagrams(workdir, design);
      } catch (saveError) {
        // Log the error but don't fail the action
        logger.warn(`[${this.name}] Could not save design diagrams:`, saveError);
      }

      return this.createOutput(
        design,
        'completed'
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in API design:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to design API: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Create a prompt for API design based on requirements
   * @param requirements - The requirements to base the design on
   * @returns The formatted prompt
   */
  private createDesignPrompt(requirements: string): string {
    return `
    As a senior API designer, create a comprehensive API design for the following requirements:
    
    REQUIREMENTS:
    ${requirements}
    
    Your design should include:
    
    1. Implementation approach
       - Analyze the difficult points of the requirements
       - Select appropriate open-source frameworks
       - Outline implementation strategies
    
    2. File list
       - List all necessary files with relative paths
       - Be sure to include main.py or app.py
    
    3. Data structures and interfaces
       - Use mermaid classDiagram code syntax
       - Include classes, methods (including __init__), and functions with type annotations
       - Clearly mark relationships between classes
       - Follow PEP8 standards
       - Make the data structures very detailed with comprehensive API design
    
    4. Program call flow
       - Use mermaid sequenceDiagram code syntax
       - Make it complete and very detailed
       - Use the classes and APIs defined above
       - Cover the CRUD and initialization of each object
       - Ensure syntax correctness
    
    5. Anything UNCLEAR
       - Mention any aspects of the project that remain unclear
       - Try to clarify these aspects
    
    Format your response using markdown, with clear section headers for each of the above categories.
    For diagrams, use proper mermaid code blocks (e.g., \`\`\`mermaid).
    `;
  }

  /**
   * Create a prompt for refining existing API design
   * @param requirements - New requirements to incorporate
   * @param existingDesign - Existing design to refine
   * @returns The formatted prompt
   */
  private createRefinementPrompt(requirements: string, existingDesign: string): string {
    return `
    As a senior API designer, refine the existing API design based on new requirements:
    
    LEGACY CONTENT:
    ${existingDesign}
    
    NEW REQUIREMENTS:
    ${requirements}
    
    Your refined design should include:
    
    1. Refined Implementation Approach
       - Update and extend the original implementation approach
       - Reflect evolving challenges and requirements
       - Outline detailed implementation strategies
    
    2. Refined File list
       - Update and expand the original file list
       - Include only relative paths
       - Limit to adding up to 2 new files
    
    3. Refined Data structures and interfaces
       - Update the existing mermaid classDiagram
       - Add new classes, methods, and functions as needed
       - Maintain clear relationships between classes
       - Retain important content from the original design
    
    4. Refined Program call flow
       - Extend the existing sequenceDiagram
       - Reflect changes in classes and APIs
       - Maintain correct syntax
       - Retain important content from the original design
    
    5. Anything UNCLEAR
       - Mention any aspects that remain unclear
       - Try to clarify these aspects
    
    Format your response using markdown, with clear section headers for each of the above categories.
    For diagrams, use proper mermaid code blocks (e.g., \`\`\`mermaid).
    `;
  }

  /**
   * Extract and save design diagrams from the LLM output
   * @param workdir - The working directory for saving diagrams
   * @param design - The design content containing mermaid diagrams
   */
  private async saveDesignDiagrams(workdir: string, design: string): Promise<void> {
    const baseDir = path.join(workdir, 'designs');
    const classDiagramsDir = path.join(baseDir, 'class_diagrams');
    const sequenceDiagramsDir = path.join(baseDir, 'sequence_diagrams');

    // Create base directory and subdirectories
    await fs.mkdir(baseDir, { recursive: true });
    await fs.mkdir(classDiagramsDir, { recursive: true });
    await fs.mkdir(sequenceDiagramsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Extract and save class diagrams
    const classDiagrams = this.extractDiagrams(design, /```mermaid\s*\n*classDiagram([\s\S]*?)```/g);
    for (let i = 0; i < classDiagrams.length; i++) {
      const filename = path.join(classDiagramsDir, `class_diagram_${timestamp}_${i + 1}.mmd`);
      await fs.writeFile(filename, classDiagrams[i].trim());
    }

    // Extract and save sequence diagrams
    const sequenceDiagrams = this.extractDiagrams(design, /```mermaid\s*\n*sequenceDiagram([\s\S]*?)```/g);
    for (let i = 0; i < sequenceDiagrams.length; i++) {
      const filename = path.join(sequenceDiagramsDir, `sequence_diagram_${timestamp}_${i + 1}.mmd`);
      await fs.writeFile(filename, sequenceDiagrams[i].trim());
    }
  }

  /**
   * Extract diagrams from the design content
   * @param design - The design content
   * @param regex - The regex pattern to match diagrams
   * @returns An array of diagram content
   */
  private extractDiagrams(design: string, regex: RegExp): string[] {
    const diagrams = [];
    const matches = design.match(regex);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        const diagramContent = match.replace(/```mermaid\s*\n*/, '').replace(/```$/, '');
        diagrams.push(diagramContent);
      }
    }
    return diagrams;
  }
} 