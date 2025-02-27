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
        const basicSummary = {
          overview: {
            title: 'No Code Provided',
            description: 'No code was provided for summarization.',
            language: 'Unknown',
            primary_purpose: 'N/A',
            line_count: 0,
            estimated_complexity: 'LOW'
          }
        };
        return this.createOutput(
          this.formatSummary(basicSummary as CodeSummary, summaryOptions),
          'completed'
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
      
      // Create a basic fallback summary
      const fallbackSummary = this.createFallbackSummary(
        this.getArg<string>('code') || '',
        this.getArg<string>('language') || 'Unknown',
        this.getArg<string>('file_path')
      );
      
      return this.createOutput(
        this.formatSummary(fallbackSummary, this.getArg<SummarizeCodeOptions>('options')),
        'completed',
        fallbackSummary
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
    try {
      // Detect language if not provided
      const detectedLanguage = language || await this.detectLanguage(code, filePath);
      
      // Construct prompt for code analysis
      const prompt = this.constructAnalysisPrompt(code, detectedLanguage, filePath, options);
      
      // Get LLM response
      const response = await this.ask(prompt);
      
      try {
        // Try to parse the JSON response
        let summary: Partial<CodeSummary>;
        try {
          summary = JSON.parse(response) as Partial<CodeSummary>;
        } catch (parseError) {
          logger.error(`[${this.name}] Failed to parse JSON response:`, parseError);
          logger.debug(`[${this.name}] Raw response:`, response);
          
          // Try to extract JSON from the response
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              summary = JSON.parse(jsonMatch[0]) as Partial<CodeSummary>;
            } catch (secondError) {
              logger.error(`[${this.name}] Failed to extract and parse JSON:`, secondError);
              throw new Error('Failed to parse code analysis response');
            }
          } else {
            throw new Error('No valid JSON found in response');
          }
        }
        
        // Validate and ensure all required fields are present
        if (!summary || typeof summary !== 'object') {
          throw new Error('Invalid summary format');
        }

        // Create overview with defaults for missing fields
        const overview = {
          title: summary.overview?.title || 'Unknown Code',
          description: summary.overview?.description || 'No description available',
          language: summary.overview?.language || detectedLanguage,
          primary_purpose: summary.overview?.primary_purpose || 'Unable to automatically determine the primary purpose',
          line_count: summary.overview?.line_count || code.split('\n').length,
          estimated_complexity: summary.overview?.estimated_complexity || 'LOW'
        };

        // Validate and normalize components
        const components = Array.isArray(summary.components) ? summary.components.map(comp => ({
          name: comp.name || 'Unknown Component',
          type: comp.type || ComponentType.OTHER,
          description: comp.description || 'No description available',
          location: comp.location,
          dependencies: Array.isArray(comp.dependencies) ? comp.dependencies : undefined,
          complexity: typeof comp.complexity === 'number' ? comp.complexity : undefined,
          lineCount: typeof comp.lineCount === 'number' ? comp.lineCount : undefined
        })) : [];

        // Validate and normalize functional areas
        const functional_areas = Array.isArray(summary.functional_areas) ? summary.functional_areas.map(area => ({
          name: area.name || 'Unknown Area',
          description: area.description || 'No description available',
          components: Array.isArray(area.components) ? area.components : []
        })) : [];

        // Validate and normalize design patterns
        const design_patterns = Array.isArray(summary.design_patterns) ? summary.design_patterns.map(pattern => ({
          name: pattern.name || 'Unknown Pattern',
          confidence: typeof pattern.confidence === 'number' ? pattern.confidence : 0,
          description: pattern.description || 'No description available',
          location: pattern.location,
          benefits: Array.isArray(pattern.benefits) ? pattern.benefits : []
        })) : [];

        // Validate and normalize relationships
        const relationships = {
          imports: Array.isArray(summary.relationships?.imports) ? summary.relationships.imports : [],
          exports: Array.isArray(summary.relationships?.exports) ? summary.relationships.exports : [],
          internal_dependencies: Array.isArray(summary.relationships?.internal_dependencies) ? 
            summary.relationships.internal_dependencies.map(dep => ({
              from: dep.from || '',
              to: dep.to || '',
              type: dep.type || 'USES'
            })) : []
        };

        // Validate and normalize improvements
        const improvements = Array.isArray(summary.improvements) ? summary.improvements.map(imp => ({
          description: imp.description || 'Unknown improvement',
          rationale: imp.rationale || 'No rationale provided',
          priority: imp.priority || 'LOW',
          implementation_difficulty: imp.implementation_difficulty || 'MODERATE',
          code_example: imp.code_example
        })) : [];

        // Validate and normalize documentation
        const documentation = {
          quality: summary.documentation?.quality || 'POOR',
          coverage_percentage: typeof summary.documentation?.coverage_percentage === 'number' ? 
            summary.documentation.coverage_percentage : 0,
          missing_documentation: Array.isArray(summary.documentation?.missing_documentation) ? 
            summary.documentation.missing_documentation : ['All components'],
          suggestions: Array.isArray(summary.documentation?.suggestions) ? 
            summary.documentation.suggestions : ['Add JSDoc or similar documentation to functions and classes']
        };

        // Return complete and validated summary
        return {
          overview,
          components,
          functional_areas,
          design_patterns,
          relationships,
          improvements,
          documentation
        };
      } catch (parseError) {
        logger.error(`[${this.name}] Error parsing code analysis response:`, parseError);
        throw new Error('Failed to parse code analysis response');
      }
    } catch (error) {
      logger.error(`[${this.name}] Error in analyzeCode:`, error);
      throw error;
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
  private async detectLanguage(code: string, filePath?: string): Promise<string> {
    try {
      // Try to detect from file extension first
      if (filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (ext) {
          const extensionMap: { [key: string]: string } = {
            'ts': 'TypeScript',
            'tsx': 'TypeScript',
            'js': 'JavaScript',
            'jsx': 'JavaScript',
            'py': 'Python',
            'java': 'Java',
            'rb': 'Ruby',
            'php': 'PHP',
            'go': 'Go',
            'rs': 'Rust',
            'cs': 'C#',
            'cpp': 'C++',
            'cc': 'C++',
            'cxx': 'C++',
            'c': 'C',
            'swift': 'Swift',
            'kt': 'Kotlin',
            'scala': 'Scala',
            'r': 'R',
            'dart': 'Dart',
            'sh': 'Shell',
            'bash': 'Shell',
            'sql': 'SQL'
          };
          
          if (ext in extensionMap) {
            return extensionMap[ext];
          }
        }
      }

      // Try to detect from code content
      const codeLines = code.split('\n');
      const firstLine = codeLines[0]?.toLowerCase() || '';
      const firstNonEmptyLine = codeLines.find(line => line.trim().length > 0)?.toLowerCase() || '';

      // Check for shebang
      if (firstLine.startsWith('#!')) {
        if (firstLine.includes('python')) return 'Python';
        if (firstLine.includes('node')) return 'JavaScript';
        if (firstLine.includes('bash') || firstLine.includes('sh')) return 'Shell';
      }

      // Check for language-specific patterns
      if (firstNonEmptyLine.includes('<?php')) return 'PHP';

      // Look for language-specific keywords and patterns in first 1000 characters
      const codeSnippet = code.substring(0, 1000);
      
      const languagePatterns: [RegExp, string][] = [
        [/\b(interface|namespace|type)\s+\w+/i, 'TypeScript'],
        [/\b(import\s+React|export\s+default|const\s+\w+\s*=\s*\(\)\s*=>)/i, 'JavaScript'],
        [/\b(def\s+\w+|import\s+\w+\s*:\s*\w+)/i, 'Python'],
        [/\b(public|private)\s+class\s+\w+/i, 'Java'],
        [/\b(func\s+\w+|package\s+\w+)/i, 'Go'],
        [/\b(fn\s+\w+|pub\s+\w+)/i, 'Rust'],
        [/\busing\s+System;/i, 'C#'],
        [/#include\s*<\w+>/i, 'C++'],
        [/\b(module|class)\s+\w+\s*\n\s*end\b/i, 'Ruby']
      ];

      for (const [pattern, language] of languagePatterns) {
        if (pattern.test(codeSnippet)) {
          return language;
        }
      }

      // If still uncertain, try to detect from imports and common patterns
      const importPatterns: [RegExp, string][] = [
        [/\bimport\s+{\s*[\w\s,]+}\s+from\s+['"][@\w/-]+['"]/i, 'TypeScript'],
        [/\brequire\(['"][\w/-]+['"]\)/i, 'JavaScript'],
        [/\bfrom\s+[\w.]+\s+import\s+[\w*,\s]+/i, 'Python'],
        [/\bimport\s+[\w.]+;/i, 'Java']
      ];

      for (const [pattern, language] of importPatterns) {
        if (pattern.test(codeSnippet)) {
          return language;
        }
      }

      // If still uncertain and code is non-empty, ask LLM
      if (code.trim().length > 0) {
        try {
          const prompt = `Please identify the programming language of this code. Respond with ONLY the language name:\n\n${codeSnippet}`;
          const response = await this.ask(prompt);
          if (response && typeof response === 'string') {
            const detectedLanguage = response.trim();
            // Validate the response is a known language
            const knownLanguages = new Set([
              'TypeScript', 'JavaScript', 'Python', 'Java', 'Ruby', 'PHP',
              'Go', 'Rust', 'C#', 'C++', 'C', 'Swift', 'Kotlin', 'Scala',
              'R', 'Dart', 'Shell', 'SQL'
            ]);
            if (knownLanguages.has(detectedLanguage)) {
              return detectedLanguage;
            }
          }
        } catch (error) {
          logger.error(`[${this.name}] Error asking LLM for language detection:`, error);
        }
      }

      // Default to Unknown if all detection methods fail
      return 'Unknown';
    } catch (error) {
      logger.error(`[${this.name}] Error detecting language:`, error);
      return 'Unknown';
    }
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
    let output = '';

    // Title and overview section - always included
    output += `# Code Summary: ${summary.overview.title}\n\n`;
    output += `## Overview\n\n`;
    output += `${summary.overview.description}\n\n`;
    output += `**Language**: ${summary.overview.language}\n`;
    output += `**Primary Purpose**: ${summary.overview.primary_purpose}\n`;
    output += `**Line Count**: ${summary.overview.line_count}\n`;
    output += `**Complexity**: ${summary.overview.estimated_complexity}\n\n`;

    // Additional sections based on summary level
    if (level !== SummaryLevel.BRIEF) {
      // Components section
      if (options?.focus_on_components !== false && summary.components.length > 0) {
        output += `## Components\n\n`;
        for (const component of summary.components) {
          output += `### ${component.name}\n\n`;
          output += `**Type**: ${component.type}\n`;
          output += `**Description**: ${component.description}\n`;
          if (level === SummaryLevel.DETAILED) {
            if (component.location) output += `**Location**: ${component.location}\n`;
            if (component.dependencies) output += `**Dependencies**: ${component.dependencies.join(', ')}\n`;
            if (component.complexity) output += `**Complexity Score**: ${component.complexity}\n`;
            if (component.lineCount) output += `**Line Count**: ${component.lineCount}\n`;
          }
          output += '\n';
        }
      }

      // Functional areas section
      if (summary.functional_areas.length > 0) {
        output += `## Functional Areas\n\n`;
        for (const area of summary.functional_areas) {
          output += `### ${area.name}\n\n`;
          output += `${area.description}\n\n`;
          if (level === SummaryLevel.DETAILED && area.components.length > 0) {
            output += `**Components**: ${area.components.join(', ')}\n\n`;
          }
        }
      }

      // Design patterns section
      if (options?.focus_on_patterns !== false && summary.design_patterns.length > 0) {
        output += `## Design Patterns\n\n`;
        for (const pattern of summary.design_patterns) {
          output += `### ${pattern.name}\n\n`;
          output += `**Confidence**: ${Math.round(pattern.confidence * 100)}%\n`;
          output += `**Description**: ${pattern.description}\n`;
          if (level === SummaryLevel.DETAILED) {
            if (pattern.location) output += `**Location**: ${pattern.location}\n`;
            if (pattern.benefits.length > 0) {
              output += `\n**Benefits**:\n`;
              pattern.benefits.forEach(benefit => output += `- ${benefit}\n`);
            }
          }
          output += '\n';
        }
      }

      // Dependencies and relationships section
      if (level === SummaryLevel.DETAILED && 
          (summary.relationships.imports.length > 0 || 
           summary.relationships.exports.length > 0 || 
           summary.relationships.internal_dependencies.length > 0)) {
        output += `## Dependencies and Relationships\n\n`;
        
        if (summary.relationships.imports.length > 0) {
          output += `### External Dependencies\n\n`;
          summary.relationships.imports.forEach(imp => output += `- ${imp}\n`);
          output += '\n';
        }
        
        if (summary.relationships.exports.length > 0) {
          output += `### Exports\n\n`;
          summary.relationships.exports.forEach(exp => output += `- ${exp}\n`);
          output += '\n';
        }
        
        if (summary.relationships.internal_dependencies.length > 0) {
          output += `### Internal Dependencies\n\n`;
          summary.relationships.internal_dependencies.forEach(dep => 
            output += `- ${dep.from} ${dep.type} ${dep.to}\n`
          );
          output += '\n';
        }
      }

      // Improvements section
      if (options?.focus_on_improvements !== false && summary.improvements.length > 0) {
        output += `## Suggested Improvements\n\n`;
        for (const improvement of summary.improvements) {
          output += `### ${improvement.description}\n\n`;
          output += `**Rationale**: ${improvement.rationale}\n`;
          output += `**Priority**: ${improvement.priority}\n`;
          output += `**Difficulty**: ${improvement.implementation_difficulty}\n`;
          if (level === SummaryLevel.DETAILED && improvement.code_example) {
            output += `\n**Example**:\n\`\`\`\n${improvement.code_example}\n\`\`\`\n`;
          }
          output += '\n';
        }
      }

      // Documentation section
      if (options?.focus_on_documentation !== false) {
        output += `## Documentation Analysis\n\n`;
        output += `**Quality**: ${summary.documentation.quality === 'POOR' ? '❌' : '✅'} ${summary.documentation.quality}\n`;
        output += `**Coverage**: ${summary.documentation.coverage_percentage}%\n\n`;
        
        if (summary.documentation.missing_documentation.length > 0) {
          output += `**Missing Documentation**:\n\n`;
          summary.documentation.missing_documentation.forEach(doc => 
            output += `- ${doc}\n`
          );
          output += '\n';
        }
        
        if (summary.documentation.suggestions.length > 0) {
          output += `**Suggestions**:\n\n`;
          summary.documentation.suggestions.forEach(suggestion => 
            output += `- ${suggestion}\n`
          );
          output += '\n';
        }
      }
    }

    return output.trim();
  }
} 