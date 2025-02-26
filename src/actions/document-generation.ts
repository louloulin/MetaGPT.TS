/**
 * Document Generation Action
 * 
 * This action generates various types of documentation including API documentation,
 * user guides, technical specifications, and other project documentation.
 */

import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import type { Document } from '../types/document';
import { DocumentStatus } from '../types/document';
import { logger } from '../utils/logger';

/**
 * Document type enum
 */
export enum DocumentType {
  API_DOCUMENTATION = 'API_DOCUMENTATION',
  USER_GUIDE = 'USER_GUIDE',
  TECHNICAL_SPECIFICATION = 'TECHNICAL_SPECIFICATION',
  README = 'README',
  INSTALLATION_GUIDE = 'INSTALLATION_GUIDE',
  TUTORIAL = 'TUTORIAL',
  REFERENCE = 'REFERENCE',
  ARCHITECTURE_DOCUMENT = 'ARCHITECTURE_DOCUMENT',
  RELEASE_NOTES = 'RELEASE_NOTES',
  CONTRIBUTION_GUIDE = 'CONTRIBUTION_GUIDE',
  CODE_STYLE_GUIDE = 'CODE_STYLE_GUIDE',
  DESIGN_DOCUMENT = 'DESIGN_DOCUMENT'
}

/**
 * Documentation format
 */
export enum DocumentFormat {
  MARKDOWN = 'MARKDOWN',
  HTML = 'HTML',
  PDF = 'PDF',
  PLAIN_TEXT = 'PLAIN_TEXT',
  JSON = 'JSON',
  XML = 'XML'
}

/**
 * Template section interface for document sections
 */
export interface TemplateSection {
  title: string;
  description: string;
  required: boolean;
  content_prompt: string;
  order: number;
}

/**
 * Document metadata interface
 */
export interface DocumentMetadata {
  version: string;
  date: string;
  author: string;
  contributors?: string[];
  project_name: string;
  project_description?: string;
  copyright?: string;
  license?: string;
  contact_info?: string;
  related_documents?: string[];
  tags?: string[];
  revision_history?: Array<{
    version: string;
    date: string;
    author: string;
    description: string;
  }>;
}

/**
 * Document generation result interface
 */
export interface DocumentGenerationResult {
  title: string;
  content: string;
  type: DocumentType;
  format: DocumentFormat;
  metadata: DocumentMetadata;
  sections: Record<string, string>;
  toc: string[];
  keywords: string[];
  references: string[];
  file_path?: string;
}

/**
 * Document generation configuration interface
 */
export interface DocumentGenerationConfig {
  title: string;
  type: DocumentType;
  format?: DocumentFormat;
  target_audience?: string;
  content_source?: {
    code_paths?: string[];
    spec_paths?: string[];
    repository_url?: string;
    api_endpoints?: string[];
    existing_docs?: string[];
  };
  template_sections?: TemplateSection[];
  metadata?: Partial<DocumentMetadata>;
  style_guide?: {
    tone?: string;
    use_examples?: boolean;
    include_diagrams?: boolean;
    max_length?: number;
    formatting_preferences?: string[];
  };
  output_file?: string;
}

/**
 * Action for generating documentation for various purposes
 */
export class DocumentGeneration extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'DocumentGeneration',
      description: config.description || 'Generates various types of documentation including API docs, user guides, and technical specifications'
    });
  }

  /**
   * Runs the document generation action
   * @returns The document generation result
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running Document Generation action`);
      
      // Get required parameters
      const title = this.getArg<string>('title');
      const type = this.getArg<DocumentType>('type');
      
      if (!title) {
        return this.createOutput(
          'No document title provided. Please provide a title for the document.',
          'failed'
        );
      }
      
      if (!type) {
        return this.createOutput(
          'No document type provided. Please provide a type for the document.',
          'failed'
        );
      }
      
      // Get optional parameters
      const format = this.getArg<DocumentFormat>('format') || DocumentFormat.MARKDOWN;
      const targetAudience = this.getArg<string>('target_audience');
      const contentSource = this.getArg<DocumentGenerationConfig['content_source']>('content_source') || {};
      const templateSections = this.getArg<TemplateSection[]>('template_sections');
      const metadata = this.getArg<Partial<DocumentMetadata>>('metadata') || {};
      const styleGuide = this.getArg<DocumentGenerationConfig['style_guide']>('style_guide') || {};
      const outputFile = this.getArg<string>('output_file');
      
      // Generate the document
      const result = await this.generateDocument({
        title,
        type,
        format,
        target_audience: targetAudience,
        content_source: contentSource,
        template_sections: templateSections,
        metadata,
        style_guide: styleGuide,
        output_file: outputFile
      });
      
      // Format the document
      const formattedDocument = this.formatDocument(result);
      
      // Create appropriate output
      return this.createOutput(
        formattedDocument,
        'completed',
        result
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in Document Generation action:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to generate document: ${error}`,
        'failed'
      );
    }
  }
  
  /**
   * Generates a document based on the provided configuration
   * @param config Document generation configuration
   * @returns Generated document
   */
  private async generateDocument(config: DocumentGenerationConfig): Promise<DocumentGenerationResult> {
    logger.info(`[${this.name}] Generating ${config.type} document: ${config.title}`);
    
    // Prepare metadata with defaults
    const currentDate = new Date().toISOString().split('T')[0];
    const fullMetadata: DocumentMetadata = {
      version: '1.0.0',
      date: currentDate,
      author: 'MetaGPT Document Generator',
      project_name: config.title,
      ...config.metadata
    };
    
    // Create table of contents based on template sections or document type
    const toc = this.generateTableOfContents(config);
    
    // Generate document content
    const prompt = this.constructDocumentPrompt(config, fullMetadata, toc);
    const response = await this.ask(prompt);
    
    try {
      // Parse the document content from the response
      const result = JSON.parse(response) as Omit<DocumentGenerationResult, 'metadata' | 'type' | 'format'>;
      
      // Create final document result
      const documentResult: DocumentGenerationResult = {
        ...result,
        type: config.type,
        format: config.format || DocumentFormat.MARKDOWN,
        metadata: fullMetadata,
        file_path: config.output_file
      };
      
      return documentResult;
    } catch (error) {
      logger.error(`[${this.name}] Error parsing document generation response:`, error);
      
      // Create a fallback document result
      return this.createFallbackDocument(config, fullMetadata, error as Error);
    }
  }
  
  /**
   * Generates a table of contents based on the document type and template sections
   * @param config Document generation configuration
   * @returns Generated table of contents
   */
  private generateTableOfContents(config: DocumentGenerationConfig): string[] {
    // If template sections are provided, use them to generate the TOC
    if (config.template_sections && config.template_sections.length > 0) {
      // Sort sections by order
      const sortedSections = [...config.template_sections].sort((a, b) => a.order - b.order);
      return sortedSections.map(section => section.title);
    }
    
    // Otherwise, use default TOC based on document type
    switch (config.type) {
      case DocumentType.API_DOCUMENTATION:
        return [
          'Introduction',
          'Authentication',
          'Endpoints',
          'Request/Response Examples',
          'Error Handling',
          'Rate Limiting',
          'Versioning',
          'SDK Examples',
          'FAQ'
        ];
      
      case DocumentType.USER_GUIDE:
        return [
          'Introduction',
          'Getting Started',
          'Installation',
          'Basic Usage',
          'Advanced Features',
          'Troubleshooting',
          'FAQ',
          'Glossary'
        ];
      
      case DocumentType.TECHNICAL_SPECIFICATION:
        return [
          'Overview',
          'Architecture',
          'Components',
          'Interfaces',
          'Data Model',
          'Security Considerations',
          'Performance Requirements',
          'Development Guidelines',
          'Testing Strategy'
        ];
      
      case DocumentType.README:
        return [
          'Project Overview',
          'Installation',
          'Quick Start',
          'Features',
          'Usage Examples',
          'Configuration',
          'Contributing',
          'License'
        ];
      
      default:
        return [
          'Introduction',
          'Main Content',
          'Conclusion',
          'References'
        ];
    }
  }
  
  /**
   * Constructs a prompt for document generation
   * @param config Document generation configuration
   * @param metadata Document metadata
   * @param toc Table of contents
   * @returns Constructed prompt
   */
  private constructDocumentPrompt(
    config: DocumentGenerationConfig,
    metadata: DocumentMetadata,
    toc: string[]
  ): string {
    // Document type description
    const documentTypeDescription = this.getDocumentTypeDescription(config.type);
    
    // Target audience
    const audienceText = config.target_audience
      ? `Target Audience: ${config.target_audience}\n\n`
      : '';
    
    // Style guide
    const styleGuideText = config.style_guide
      ? `Style Guidelines:
- Tone: ${config.style_guide.tone || 'Professional'}
- Use examples: ${config.style_guide.use_examples !== false ? 'Yes' : 'No'}
- Include diagrams: ${config.style_guide.include_diagrams === true ? 'Yes' : 'No'}
- Max length: ${config.style_guide.max_length || 'No specific limit'}
${config.style_guide.formatting_preferences ? `- Formatting preferences: ${config.style_guide.formatting_preferences.join(', ')}` : ''}
\n\n`
      : '';
    
    // Content sources
    const contentSourceText = config.content_source && Object.keys(config.content_source).length > 0
      ? `Content Sources:
${config.content_source.code_paths?.length ? `- Code paths: ${config.content_source.code_paths.join(', ')}` : ''}
${config.content_source.spec_paths?.length ? `- Specification paths: ${config.content_source.spec_paths.join(', ')}` : ''}
${config.content_source.repository_url ? `- Repository URL: ${config.content_source.repository_url}` : ''}
${config.content_source.api_endpoints?.length ? `- API endpoints: ${config.content_source.api_endpoints.join(', ')}` : ''}
${config.content_source.existing_docs?.length ? `- Existing docs: ${config.content_source.existing_docs.join(', ')}` : ''}
\n\n`
      : '';
    
    // Template sections
    const templateSectionsText = config.template_sections?.length
      ? `Document Sections:
${config.template_sections.sort((a, b) => a.order - b.order).map(section => 
  `${section.title} (${section.required ? 'Required' : 'Optional'}): ${section.description}`
).join('\n')}
\n\n`
      : '';
    
    // Construct the full prompt
    return `
# Document Generation Task

## Document Details
Title: ${config.title}
Type: ${config.type} - ${documentTypeDescription}
Format: ${config.format || DocumentFormat.MARKDOWN}

${audienceText}
${styleGuideText}
${contentSourceText}
${templateSectionsText}

## Document Metadata
Version: ${metadata.version}
Date: ${metadata.date}
Author: ${metadata.author}
${metadata.contributors?.length ? `Contributors: ${metadata.contributors.join(', ')}` : ''}
Project: ${metadata.project_name}
${metadata.project_description ? `Project Description: ${metadata.project_description}` : ''}
${metadata.license ? `License: ${metadata.license}` : ''}

## Table of Contents
${toc.map((section, index) => `${index + 1}. ${section}`).join('\n')}

## Task
Generate a comprehensive and well-structured ${config.type} document based on the provided details. 
The document should follow the table of contents above and incorporate any style guidelines specified.

## Instructions
1. Create content for each section in the table of contents
2. Ensure the document is accurate, clear, and helpful for the target audience
3. Include examples, code snippets, and diagrams where appropriate
4. Follow the specified style and formatting guidelines
5. Provide references where applicable

## Response Format
Provide your response as a JSON object with the following structure:
{
  "title": "Document title",
  "content": "The full document content",
  "sections": {
    "section_name": "section content",
    ...
  },
  "toc": ["Section 1", "Section 2", ...],
  "keywords": ["keyword1", "keyword2", ...],
  "references": ["reference1", "reference2", ...]
}
`;
  }
  
  /**
   * Gets a description for the document type
   * @param type Document type
   * @returns Description of the document type
   */
  private getDocumentTypeDescription(type: DocumentType): string {
    switch (type) {
      case DocumentType.API_DOCUMENTATION:
        return 'Detailed documentation of API endpoints, parameters, and examples';
      
      case DocumentType.USER_GUIDE:
        return 'Step-by-step instructions for end users on how to use the software';
      
      case DocumentType.TECHNICAL_SPECIFICATION:
        return 'Detailed technical information about the system architecture and components';
      
      case DocumentType.README:
        return 'Overview of the project, installation instructions, and basic usage information';
      
      case DocumentType.INSTALLATION_GUIDE:
        return 'Detailed instructions for installing and configuring the software';
      
      case DocumentType.TUTORIAL:
        return 'Step-by-step guide for learning specific features or tasks';
      
      case DocumentType.REFERENCE:
        return 'Comprehensive reference of all features, classes, or functions';
      
      case DocumentType.ARCHITECTURE_DOCUMENT:
        return 'Detailed description of the system architecture, components, and their interactions';
      
      case DocumentType.RELEASE_NOTES:
        return 'Summary of changes, improvements, and bug fixes in a software release';
      
      case DocumentType.CONTRIBUTION_GUIDE:
        return 'Guidelines for contributing to the project, including code standards and processes';
      
      case DocumentType.CODE_STYLE_GUIDE:
        return 'Standards and conventions for writing code in the project';
      
      case DocumentType.DESIGN_DOCUMENT:
        return 'Description of the design decisions, patterns, and implementation details';
      
      default:
        return 'General documentation';
    }
  }
  
  /**
   * Creates a fallback document when the LLM response cannot be parsed
   * @param config Document generation configuration
   * @param metadata Document metadata
   * @param error The error that occurred
   * @returns A fallback document result
   */
  private createFallbackDocument(
    config: DocumentGenerationConfig,
    metadata: DocumentMetadata,
    error: Error
  ): DocumentGenerationResult {
    const toc = this.generateTableOfContents(config);
    
    return {
      title: config.title,
      content: `# ${config.title}\n\n**Error:** Unable to generate complete document. Please try again.\n\n## Error Details\n\n${error.message}`,
      type: config.type,
      format: config.format || DocumentFormat.MARKDOWN,
      metadata,
      sections: {
        'Introduction': `**Error:** Document generation failed with error: ${error.message}`,
        'Error Details': `Failed to parse LLM response into a valid document structure. Please try again with a more specific document configuration.`
      },
      toc,
      keywords: ['error', 'document generation', config.type.toLowerCase()],
      references: [],
      file_path: config.output_file
    };
  }
  
  /**
   * Formats a document result into a readable format
   * @param result Document generation result
   * @returns Formatted document string
   */
  private formatDocument(result: DocumentGenerationResult): string {
    // For markdown or plain text, return the content directly
    if (result.format === DocumentFormat.MARKDOWN || result.format === DocumentFormat.PLAIN_TEXT) {
      return result.content;
    }
    
    // For other formats, create a simple metadata header and return content
    let formatted = '';
    
    formatted += `Title: ${result.title}\n`;
    formatted += `Type: ${result.type}\n`;
    formatted += `Format: ${result.format}\n`;
    formatted += `Version: ${result.metadata.version}\n`;
    formatted += `Date: ${result.metadata.date}\n`;
    formatted += `Author: ${result.metadata.author}\n\n`;
    
    if (result.format === DocumentFormat.HTML) {
      formatted += `<html><head><title>${result.title}</title></head><body>\n`;
      formatted += result.content;
      formatted += `\n</body></html>`;
    } else {
      formatted += result.content;
    }
    
    return formatted;
  }
  
  /**
   * Converts the document generation result to a Document object
   * @param result Document generation result
   * @returns Document object
   */
  public toDocument(result: DocumentGenerationResult): Document {
    return {
      content: result.content,
      name: result.title,
      author: result.metadata.author,
      status: DocumentStatus.DRAFT,
      path: result.file_path,
      reviews: []
    };
  }
} 