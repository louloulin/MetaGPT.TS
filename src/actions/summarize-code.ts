/**
 * SummarizeCode Action
 * 
 * This action analyzes code and generates comprehensive summaries, including 
 * functional descriptions, component breakdowns, design patterns identification,
 * and potential improvements.
 */

import { BaseAction } from './base-action';
import type { Message } from '../types/message';
import type { ActionOutput, ActionConfig } from '../types/action';
import { logger } from '../utils/logger';

/**
 * Summary level of detail
 */
export enum SummaryLevel {
  BRIEF = 'BRIEF',       // High-level overview with minimal details
  STANDARD = 'STANDARD', // Standard summary with balanced details
  DETAILED = 'DETAILED'  // In-depth summary with extensive details
}

/**
 * Code component type
 */
export enum ComponentType {
  CLASS = 'CLASS',           // Class definition
  FUNCTION = 'FUNCTION',     // Function or method
  INTERFACE = 'INTERFACE',   // Interface or type definition
  MODULE = 'MODULE',         // Module or namespace
  CONSTANT = 'CONSTANT',     // Constant declaration
  VARIABLE = 'VARIABLE',     // Variable declaration
  HOOK = 'HOOK',             // React hook
  COMPONENT = 'COMPONENT',   // UI component
  CONFIG = 'CONFIG',         // Configuration
  UTILITY = 'UTILITY',       // Utility function
  OTHER = 'OTHER'            // Other component type
}

/**
 * Structure for a code component
 */
export interface CodeComponent {
  name: string;
  type: ComponentType;
  description: string;
  location?: string;  // File path, line number, etc.
  dependencies?: string[];
  complexity?: number; // Complexity score
  lineCount?: number;  // Number of lines
}

/**
 * Structure for an identified design pattern
 */
export interface DesignPattern {
  name: string;
  confidence: number; // 0-1 score of confidence
  description: string;
  location?: string;
  benefits: string[];
}

/**
 * Structure for a suggested improvement
 */
export interface Improvement {
  description: string;
  rationale: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  implementation_difficulty: 'EASY' | 'MODERATE' | 'COMPLEX';
  code_example?: string;
}

/**
 * Structure for a code summary
 */
export interface CodeSummary {
  // General overview
  overview: {
    title: string;
    description: string;
    language: string;
    primary_purpose: string;
    line_count: number;
    estimated_complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  
  // Component breakdown
  components: CodeComponent[];
  
  // Functional areas
  functional_areas: {
    name: string;
    description: string;
    components: string[]; // Names of related components
  }[];
  
  // Design patterns
  design_patterns: DesignPattern[];
  
  // Relationships and dependencies
  relationships: {
    imports: string[];
    exports: string[];
    internal_dependencies: {
      from: string;
      to: string;
      type: 'USES' | 'EXTENDS' | 'IMPLEMENTS' | 'INSTANTIATES';
    }[];
  };
  
  // Suggestions for improvement
  improvements: Improvement[];
  
  // Documentation and comments analysis
  documentation: {
    quality: 'POOR' | 'ADEQUATE' | 'GOOD' | 'EXCELLENT';
    coverage_percentage: number;
    missing_documentation: string[];
    suggestions: string[];
  };
}

/**
 * Options for code summarization
 */
export interface SummarizeCodeOptions {
  level?: SummaryLevel;
  focus_on_components?: boolean;
  focus_on_patterns?: boolean;
  focus_on_improvements?: boolean;
  focus_on_documentation?: boolean;
  include_code_examples?: boolean;
  max_components?: number;
  max_improvements?: number;
}

/**
 * Action for summarizing code
 */
export class SummarizeCode extends BaseAction {
  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'SummarizeCode',
      description: config.description || 'Analyzes code and generates comprehensive summaries with functional descriptions, component breakdowns, and suggested improvements',
    });
  }

  /**
   * Runs the SummarizeCode action
   * @returns The code summary
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running SummarizeCode action`);
      
      // Get code and options from context
      const code = this.getArg<string>('code');
      const filePath = this.getArg<string>('file_path');
      const language = this.getArg<string>('language');
      const options = this.getArg<SummarizeCodeOptions>('options') || {};
      
      // Apply default options
      const summaryOptions: SummarizeCodeOptions = {
        level: options.level || SummaryLevel.STANDARD,
        focus_on_components: options.focus_on_components !== undefined ? options.focus_on_components : true,
        focus_on_patterns: options.focus_on_patterns !== undefined ? options.focus_on_patterns : true,
        focus_on_improvements: options.focus_on_improvements !== undefined ? options.focus_on_improvements : true,
        focus_on_documentation: options.focus_on_documentation !== undefined ? options.focus_on_documentation : true,
        include_code_examples: options.include_code_examples !== undefined ? options.include_code_examples : false,
        max_components: options.max_components || 20,
        max_improvements: options.max_improvements || 5
      };
      
      // Validate code input
      if (!code) {
        return this.createOutput(
          'No code provided for summarization. Please provide the code to summarize.',
          'failed'
        );
      }

      // Analyze code and generate summary
      const summary = await this.analyzeCode(code, filePath, language, summaryOptions);

      // Format the summary for output
      const formattedSummary = this.formatSummary(summary, summaryOptions);
      
      return this.createOutput(
        formattedSummary,
        'completed',
        summary
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in SummarizeCode action:`, error);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to summarize code: ${error}`,
        'failed'
      );
    }
  }

  /**
   * Analyzes code and generates a summary
   * @param code The code to analyze
   * @param filePath Optional file path for context
   * @param language Optional language hint
   * @param options Summarization options
   * @returns Code summary
   */
  private async analyzeCode(
    code: string, 
    filePath?: string, 
    language?: string,
    options?: SummarizeCodeOptions
  ): Promise<CodeSummary> {
    // Detect language if not provided
    const detectedLanguage = language || this.detectLanguage(code, filePath);
    
    // Construct prompt for code analysis
    const prompt = this.constructAnalysisPrompt(code, detectedLanguage, filePath, options);
    
    // Get LLM response
    const response = await this.ask(prompt);
    
    try {
      // Parse the JSON response
      const summary = JSON.parse(response) as CodeSummary;
      return summary;
    } catch (error) {
      logger.error('Failed to parse LLM response as JSON', error);
      // Create fallback summary if parsing fails
      return this.createFallbackSummary(code, detectedLanguage, filePath);
    }
  }

  /**
   * Constructs a prompt for code analysis
   * @param code The code to analyze
   * @param language The programming language
   * @param filePath Optional file path for context
   * @param options Summarization options
   * @returns Prompt for the LLM
   */
  private constructAnalysisPrompt(
    code: string, 
    language: string, 
    filePath?: string,
    options?: SummarizeCodeOptions
  ): string {
    const level = options?.level || SummaryLevel.STANDARD;
    const focusComponents = options?.focus_on_components !== false;
    const focusPatterns = options?.focus_on_patterns !== false;
    const focusImprovements = options?.focus_on_improvements !== false;
    const focusDocumentation = options?.focus_on_documentation !== false;
    const includeExamples = options?.include_code_examples === true;
    const maxComponents = options?.max_components || 20;
    const maxImprovements = options?.max_improvements || 5;
    
    let prompt = `
    Please analyze the following ${language} code ${filePath ? `in file ${filePath}` : ''}:
    
    \`\`\`${language}
    ${code}
    \`\`\`
    
    Provide a ${level.toLowerCase()} summary of this code as a valid JSON object with the following structure:
    
    {
      "overview": {
        "title": "Brief title describing the code",
        "description": "Overall description of what the code does",
        "language": "${language}",
        "primary_purpose": "Main purpose of this code",
        "line_count": number of lines in the code,
        "estimated_complexity": "LOW", "MEDIUM", or "HIGH"
      },
    `;
    
    if (focusComponents) {
      prompt += `
      "components": [
        {
          "name": "Component name",
          "type": "Component type (CLASS, FUNCTION, INTERFACE, MODULE, CONSTANT, VARIABLE, HOOK, COMPONENT, CONFIG, UTILITY, OTHER)",
          "description": "What this component does",
          "location": "Location information if available",
          "dependencies": ["List of dependencies"],
          "complexity": numerical complexity score,
          "lineCount": number of lines
        }
      ],
      "functional_areas": [
        {
          "name": "Functional area name",
          "description": "Description of this functional area",
          "components": ["List of component names in this area"]
        }
      ],
      `;
    }
    
    if (focusPatterns) {
      prompt += `
      "design_patterns": [
        {
          "name": "Pattern name",
          "confidence": confidence score from 0-1,
          "description": "How this pattern is used in the code",
          "location": "Where this pattern appears",
          "benefits": ["Benefits of using this pattern"]
        }
      ],
      "relationships": {
        "imports": ["List of imports"],
        "exports": ["List of exports"],
        "internal_dependencies": [
          {
            "from": "Source component",
            "to": "Target component",
            "type": "Relationship type (USES, EXTENDS, IMPLEMENTS, INSTANTIATES)"
          }
        ]
      },
      `;
    }
    
    if (focusImprovements) {
      prompt += `
      "improvements": [
        {
          "description": "Suggested improvement",
          "rationale": "Why this improvement would be beneficial",
          "priority": "Priority level (HIGH, MEDIUM, LOW)",
          "implementation_difficulty": "Difficulty to implement (EASY, MODERATE, COMPLEX)"
          ${includeExamples ? `,
          "code_example": "Example code for this improvement"` : ''}
        }
      ],
      `;
    }
    
    if (focusDocumentation) {
      prompt += `
      "documentation": {
        "quality": "Documentation quality (POOR, ADEQUATE, GOOD, EXCELLENT)",
        "coverage_percentage": percentage of code that is documented,
        "missing_documentation": ["List of components missing documentation"],
        "suggestions": ["Documentation improvement suggestions"]
      }
      `;
    }
    
    prompt += `
    }
    
    Analysis guidelines:
    - Limit to at most ${maxComponents} most significant components
    - Provide up to ${maxImprovements} most valuable improvement suggestions
    - For the ${level.toLowerCase()} summary level, ${this.getSummaryLevelGuidelines(level)}
    - Focus on providing accurate and helpful insights
    - Ensure the response is valid JSON
    `;
    
    return prompt;
  }

  /**
   * Gets guidelines for different summary levels
   * @param level Summary level
   * @returns Guidelines for the specified level
   */
  private getSummaryLevelGuidelines(level: SummaryLevel): string {
    switch (level) {
      case SummaryLevel.BRIEF:
        return 'keep descriptions concise and focus only on the most important aspects';
      case SummaryLevel.STANDARD:
        return 'provide balanced descriptions with moderate detail';
      case SummaryLevel.DETAILED:
        return 'include comprehensive descriptions and capture nuanced details';
      default:
        return 'provide balanced descriptions with moderate detail';
    }
  }

  /**
   * Detects the programming language from code or file path
   * @param code The code to analyze
   * @param filePath Optional file path
   * @returns Detected language
   */
  private detectLanguage(code: string, filePath?: string): string {
    // Try to detect from file extension
    if (filePath) {
      const extension = filePath.split('.').pop()?.toLowerCase();
      
      if (extension) {
        const extensionMap: Record<string, string> = {
          'js': 'JavaScript',
          'jsx': 'JavaScript (React)',
          'ts': 'TypeScript',
          'tsx': 'TypeScript (React)',
          'py': 'Python',
          'java': 'Java',
          'c': 'C',
          'cpp': 'C++',
          'cs': 'C#',
          'go': 'Go',
          'rb': 'Ruby',
          'php': 'PHP',
          'swift': 'Swift',
          'kt': 'Kotlin',
          'rs': 'Rust',
          'scala': 'Scala',
          'sh': 'Shell',
          'html': 'HTML',
          'css': 'CSS',
          'sql': 'SQL'
        };
        
        if (extensionMap[extension]) {
          return extensionMap[extension];
        }
      }
    }
    
    // Simple heuristics for common languages
    if (code.includes('import React') || code.includes('useState(') || code.includes('function Component(')) {
      return 'JavaScript (React)';
    }
    if (code.includes('interface ') && code.includes(': ') && code.includes('export type')) {
      return 'TypeScript';
    }
    if (code.includes('def ') && code.includes('import ') && (code.includes('self') || code.includes('__init__'))) {
      return 'Python';
    }
    if (code.includes('public class ') || code.includes('private ') || code.includes('protected ')) {
      return 'Java';
    }
    if (code.includes('func ') && code.includes('package ')) {
      return 'Go';
    }
    
    // Default to JavaScript as it's common
    return 'JavaScript';
  }

  /**
   * Creates a fallback summary when parsing fails
   * @param code The code to summarize
   * @param language The programming language
   * @param filePath Optional file path
   * @returns Fallback code summary
   */
  private createFallbackSummary(code: string, language: string, filePath?: string): CodeSummary {
    // Count lines as a basic metric
    const lineCount = code.split('\n').length;
    
    // Simple component identification based on patterns
    const components: CodeComponent[] = [];
    
    // Simple regular expression to find potential functions or classes
    const functionMatches = code.match(/function\s+(\w+)\s*\(/g) || [];
    const classMatches = code.match(/class\s+(\w+)/g) || [];
    const constMatches = code.match(/const\s+(\w+)\s*=/g) || [];
    
    // Extract names and create basic components
    functionMatches.forEach((match, index) => {
      if (index < 5) { // Limit to 5 functions
        const name = match.replace(/function\s+/, '').replace(/\s*\($/, '');
        components.push({
          name,
          type: ComponentType.FUNCTION,
          description: `Function that appears to handle some functionality`,
          lineCount: 0
        });
      }
    });
    
    classMatches.forEach((match, index) => {
      if (index < 3) { // Limit to 3 classes
        const name = match.replace(/class\s+/, '');
        components.push({
          name,
          type: ComponentType.CLASS,
          description: `Class that likely encapsulates related functionality`,
          lineCount: 0
        });
      }
    });
    
    constMatches.forEach((match, index) => {
      if (index < 3) { // Limit to 3 constants
        const name = match.replace(/const\s+/, '').replace(/\s*=$/, '');
        components.push({
          name,
          type: ComponentType.CONSTANT,
          description: `Constant value used in the code`,
          lineCount: 0
        });
      }
    });
    
    return {
      overview: {
        title: filePath ? `Code in ${filePath.split('/').pop()}` : `${language} Code`,
        description: "This is a basic fallback summary as the detailed analysis failed.",
        language,
        primary_purpose: "Unable to automatically determine the primary purpose",
        line_count: lineCount,
        estimated_complexity: lineCount < 100 ? 'LOW' : lineCount < 500 ? 'MEDIUM' : 'HIGH'
      },
      components,
      functional_areas: [{
        name: "Main Functionality",
        description: "The primary functionality of this code",
        components: components.map(c => c.name)
      }],
      design_patterns: [],
      relationships: {
        imports: [],
        exports: [],
        internal_dependencies: []
      },
      improvements: [{
        description: "Consider adding more comprehensive documentation",
        rationale: "Better documentation improves code maintainability",
        priority: 'MEDIUM',
        implementation_difficulty: 'EASY'
      }],
      documentation: {
        quality: 'POOR',
        coverage_percentage: 0,
        missing_documentation: ['All components'],
        suggestions: ['Add JSDoc or similar documentation to functions and classes']
      }
    };
  }

  /**
   * Formats a code summary into human-readable markdown
   * @param summary The code summary to format
   * @param options Summarization options
   * @returns Formatted markdown string
   */
  private formatSummary(summary: CodeSummary, options?: SummarizeCodeOptions): string {
    const level = options?.level || SummaryLevel.STANDARD;
    
    let markdown = `# Code Summary: ${summary.overview.title}\n\n`;
    
    // Add overview section
    markdown += `## Overview\n\n`;
    markdown += `- **Language**: ${summary.overview.language}\n`;
    markdown += `- **Primary Purpose**: ${summary.overview.primary_purpose}\n`;
    markdown += `- **Line Count**: ${summary.overview.line_count}\n`;
    markdown += `- **Complexity**: ${summary.overview.estimated_complexity}\n\n`;
    markdown += `${summary.overview.description}\n\n`;
    
    // Add components section if requested
    if (options?.focus_on_components !== false && summary.components.length > 0) {
      markdown += `## Components\n\n`;
      
      if (level === SummaryLevel.BRIEF) {
        // Brief listing
        markdown += `This code contains ${summary.components.length} components:\n\n`;
        summary.components.forEach(component => {
          markdown += `- **${component.name}** (${component.type}): ${component.description}\n`;
        });
        markdown += '\n';
      } else {
        // Detailed listing
        summary.components.forEach(component => {
          markdown += `### ${component.name} (${component.type})\n\n`;
          markdown += `${component.description}\n\n`;
          
          if (level === SummaryLevel.DETAILED) {
            if (component.location) markdown += `- **Location**: ${component.location}\n`;
            if (component.lineCount) markdown += `- **Line Count**: ${component.lineCount}\n`;
            if (component.complexity) markdown += `- **Complexity**: ${component.complexity}\n`;
            if (component.dependencies && component.dependencies.length > 0) {
              markdown += `- **Dependencies**: ${component.dependencies.join(', ')}\n`;
            }
            markdown += '\n';
          }
        });
      }
    }
    
    // Add functional areas if available
    if (options?.focus_on_components !== false && summary.functional_areas?.length > 0) {
      markdown += `## Functional Areas\n\n`;
      
      summary.functional_areas.forEach(area => {
        markdown += `### ${area.name}\n\n`;
        markdown += `${area.description}\n\n`;
        
        if (level !== SummaryLevel.BRIEF && area.components.length > 0) {
          markdown += `**Related Components**: ${area.components.join(', ')}\n\n`;
        }
      });
    }
    
    // Add design patterns if requested
    if (options?.focus_on_patterns !== false && summary.design_patterns?.length > 0) {
      markdown += `## Design Patterns\n\n`;
      
      if (level === SummaryLevel.BRIEF) {
        // Brief listing
        markdown += `Identified patterns: ${summary.design_patterns.map(p => p.name).join(', ')}\n\n`;
      } else {
        // Detailed listing
        summary.design_patterns.forEach(pattern => {
          markdown += `### ${pattern.name} (${Math.round(pattern.confidence * 100)}% confidence)\n\n`;
          markdown += `${pattern.description}\n\n`;
          
          if (level === SummaryLevel.DETAILED) {
            if (pattern.location) markdown += `**Location**: ${pattern.location}\n\n`;
            if (pattern.benefits && pattern.benefits.length > 0) {
              markdown += `**Benefits**:\n\n`;
              pattern.benefits.forEach(benefit => {
                markdown += `- ${benefit}\n`;
              });
              markdown += '\n';
            }
          }
        });
      }
    }
    
    // Add relationships if available and detailed level
    if (options?.focus_on_patterns !== false && level !== SummaryLevel.BRIEF) {
      if (summary.relationships.imports?.length > 0 || 
          summary.relationships.exports?.length > 0 || 
          summary.relationships.internal_dependencies?.length > 0) {
        
        markdown += `## Relationships and Dependencies\n\n`;
        
        if (summary.relationships.imports?.length > 0) {
          markdown += `**Imports**:\n\n`;
          summary.relationships.imports.forEach(imp => {
            markdown += `- ${imp}\n`;
          });
          markdown += '\n';
        }
        
        if (summary.relationships.exports?.length > 0) {
          markdown += `**Exports**:\n\n`;
          summary.relationships.exports.forEach(exp => {
            markdown += `- ${exp}\n`;
          });
          markdown += '\n';
        }
        
        if (level === SummaryLevel.DETAILED && summary.relationships.internal_dependencies?.length > 0) {
          markdown += `**Internal Dependencies**:\n\n`;
          summary.relationships.internal_dependencies.forEach(dep => {
            markdown += `- ${dep.from} ${dep.type.toLowerCase()} ${dep.to}\n`;
          });
          markdown += '\n';
        }
      }
    }
    
    // Add improvements if requested
    if (options?.focus_on_improvements !== false && summary.improvements?.length > 0) {
      markdown += `## Suggested Improvements\n\n`;
      
      summary.improvements.forEach((improvement, index) => {
        const priorityEmoji = improvement.priority === 'HIGH' ? '🔴' : 
                             improvement.priority === 'MEDIUM' ? '🟡' : '🟢';
        
        markdown += `### ${index + 1}. ${priorityEmoji} ${improvement.description}\n\n`;
        markdown += `**Rationale**: ${improvement.rationale}\n\n`;
        
        if (level !== SummaryLevel.BRIEF) {
          markdown += `**Priority**: ${improvement.priority}\n`;
          markdown += `**Difficulty**: ${improvement.implementation_difficulty}\n\n`;
        }
        
        if (level === SummaryLevel.DETAILED && improvement.code_example) {
          markdown += `**Example**:\n\`\`\`\n${improvement.code_example}\n\`\`\`\n\n`;
        }
      });
    }
    
    // Add documentation analysis if requested
    if (options?.focus_on_documentation !== false) {
      markdown += `## Documentation Analysis\n\n`;
      
      const qualityEmoji = summary.documentation.quality === 'EXCELLENT' ? '✅' : 
                          summary.documentation.quality === 'GOOD' ? '✓' : 
                          summary.documentation.quality === 'ADEQUATE' ? '⚠️' : '❌';
      
      markdown += `**Quality**: ${qualityEmoji} ${summary.documentation.quality}\n`;
      markdown += `**Coverage**: ${summary.documentation.coverage_percentage}%\n\n`;
      
      if (level !== SummaryLevel.BRIEF) {
        if (summary.documentation.missing_documentation?.length > 0) {
          markdown += `**Missing Documentation**:\n\n`;
          summary.documentation.missing_documentation.forEach(item => {
            markdown += `- ${item}\n`;
          });
          markdown += '\n';
        }
        
        if (summary.documentation.suggestions?.length > 0) {
          markdown += `**Suggestions**:\n\n`;
          summary.documentation.suggestions.forEach(suggestion => {
            markdown += `- ${suggestion}\n`;
          });
          markdown += '\n';
        }
      }
    }
    
    return markdown;
  }
} 