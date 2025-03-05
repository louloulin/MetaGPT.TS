/**
 * @module CodeUnderstandingService
 * @category Services
 * @description Provides code understanding capabilities for incremental development
 */

import { z } from 'zod';
import { logger } from '../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { LLMProvider } from '../../types/llm';
import { FileScanner } from './file-scanner';

/**
 * Represents a code entity (function, class, interface, etc.)
 */
export interface CodeEntity {
  /** Name of the entity */
  name: string;
  /** Type of entity (function, class, interface, etc.) */
  type: 'function' | 'class' | 'interface' | 'variable' | 'enum' | 'type' | 'namespace' | 'module' | 'unknown';
  /** Line number where the entity starts */
  startLine: number;
  /** Line number where the entity ends */
  endLine: number;
  /** Description or documentation of the entity */
  description?: string;
  /** Parameters (for functions/methods) */
  parameters?: Array<{ name: string; type?: string; description?: string }>;
  /** Return type (for functions/methods) */
  returnType?: string;
  /** Any dependencies this entity has */
  dependencies?: string[];
  /** Parent entity name (if nested) */
  parent?: string;
  /** Children entities (if container) */
  children?: CodeEntity[];
}

/**
 * Represents a file in the code understanding system
 */
export interface CodeFile {
  /** Full path to the file */
  path: string;
  /** Language of the file */
  language: string;
  /** Entities contained in the file */
  entities: CodeEntity[];
  /** Imports/dependencies of the file */
  imports: Array<{ name: string; path: string; isType?: boolean }>;
  /** Exports from the file */
  exports: Array<{ name: string; type: string }>;
  /** Last time this file was modified */
  lastModified: Date;
  /** Hash of the file content (for change detection) */
  contentHash: string;
  /** Total line count */
  lineCount: number;
}

/**
 * Configuration for code understanding service
 */
export const CodeUnderstandingConfigSchema = z.object({
  /** LLM provider to use for code analysis */
  llm: z.any().optional(),
  /** Base directory to analyze */
  baseDir: z.string().default('./'),
  /** File patterns to include */
  include: z.array(z.string()).default(['**/*.ts', '**/*.js', '**/*.jsx', '**/*.tsx']),
  /** File patterns to exclude */
  exclude: z.array(z.string()).default(['**/node_modules/**', '**/dist/**', '**/build/**']),
  /** Whether to enable detailed analysis */
  detailedAnalysis: z.boolean().default(false),
  /** Whether to cache analysis results */
  enableCache: z.boolean().default(true),
  /** Cache directory */
  cacheDir: z.string().default('./.code-understanding-cache'),
});

export type CodeUnderstandingConfig = z.infer<typeof CodeUnderstandingConfigSchema>;

/**
 * CodeUnderstandingService provides code analysis and understanding capabilities
 * to support incremental development, code navigation, and intelligent suggestions
 */
export class CodeUnderstandingService {
  private config: CodeUnderstandingConfig;
  private llm: LLMProvider | null = null;
  private fileRegistry: Map<string, CodeFile> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private codebaseContext: string = '';
  private initialized: boolean = false;

  /**
   * Creates a new CodeUnderstandingService
   * @param config Service configuration
   */
  constructor(config: Partial<CodeUnderstandingConfig>) {
    this.config = CodeUnderstandingConfigSchema.parse(config);
    this.llm = this.config.llm || null;
    logger.info(`CodeUnderstandingService initialized with base directory: ${this.config.baseDir}`);
  }

  /**
   * Initializes the code understanding service
   * Scans the specified directory and builds an initial understanding of the codebase
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('CodeUnderstandingService already initialized');
      return;
    }

    try {
      logger.info('Initializing CodeUnderstandingService...');
      
      // Set up cache directory if enabled
      if (this.config.enableCache) {
        await this.ensureCacheDirectory();
      }
      
      // Scan files and build initial registry
      await this.scanDirectory(this.config.baseDir);
      
      // Build dependency graph
      this.buildDependencyGraph();
      
      // Generate codebase context
      await this.generateCodebaseContext();
      
      this.initialized = true;
      logger.info(`CodeUnderstandingService initialized with ${this.fileRegistry.size} files`);
    } catch (error) {
      logger.error('Failed to initialize CodeUnderstandingService:', error);
      throw new Error(`Failed to initialize code understanding service: ${error}`);
    }
  }

  /**
   * Ensures the cache directory exists
   */
  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch (error) {
      logger.warn(`Failed to create cache directory ${this.config.cacheDir}:`, error);
    }
  }

  /**
   * Scans a directory for code files
   * @param directory Directory to scan
   */
  private async scanDirectory(directory: string): Promise<void> {
    logger.info(`Scanning directory: ${directory}`);
    
    try {
      // Create a FileScanner instance
      const scanner = new FileScanner({
        baseDir: directory,
        include: this.config.include,
        exclude: this.config.exclude,
      });
      
      // Scan for files
      const scanResult = await scanner.scan();
      
      logger.info(`Found ${scanResult.files.length} files for analysis`);
      
      // Process each file
      let analyzed = 0;
      let failed = 0;
      
      for (const filePath of scanResult.files) {
        try {
          // Get relative path for registry
          const relativePath = path.relative(this.config.baseDir, filePath);
          
          // Analyze the file
          const fileInfo = await this.analyzeFile(filePath);
          
          if (fileInfo) {
            this.fileRegistry.set(relativePath, fileInfo);
            analyzed++;
            
            // Log progress every 50 files
            if (analyzed % 50 === 0) {
              logger.info(`Analyzed ${analyzed} files so far...`);
            }
          } else {
            failed++;
          }
        } catch (error) {
          logger.error(`Failed to analyze file ${filePath}:`, error);
          failed++;
        }
      }
      
      logger.info(`Completed analysis of ${analyzed} files, ${failed} files failed`);
    } catch (error) {
      logger.error(`Error scanning directory ${directory}:`, error);
      throw error;
    }
  }

  /**
   * Analyzes a file to extract code entities and structure
   * @param filePath Path to the file
   * @returns Analysis results
   */
  public async analyzeFile(filePath: string): Promise<CodeFile | null> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.config.baseDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const language = this.detectLanguage(filePath);
      
      logger.debug(`Analyzing file: ${filePath} (${language})`);
      
      // For detailed analysis, use LLM if available
      if (this.config.detailedAnalysis && this.llm) {
        return await this.detailedAnalysis(fullPath, content, language);
      }
      
      // Basic analysis using regex and heuristics
      return await this.basicAnalysis(fullPath, content, language);
    } catch (error) {
      logger.error(`Failed to analyze file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Detects the programming language based on file extension
   * @param filePath File path
   * @returns Detected language
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript React',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript React',
      '.py': 'Python',
      '.java': 'Java',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.cs': 'C#',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.rs': 'Rust',
      '.cpp': 'C++',
      '.c': 'C',
      '.h': 'C/C++ Header',
    };
    
    return languageMap[ext] || 'Unknown';
  }

  /**
   * Performs basic analysis of a file using regex and heuristics
   * @param filePath Path to the file
   * @param content File content
   * @param language Programming language
   * @returns Analysis results
   */
  private async basicAnalysis(filePath: string, content: string, language: string): Promise<CodeFile> {
    // This is a simplified implementation - a real implementation would 
    // use language-specific parsers or AST analysis
    
    const lines = content.split('\n');
    const entities: CodeEntity[] = [];
    const imports: Array<{ name: string; path: string; isType?: boolean }> = [];
    const exports: Array<{ name: string; type: string }> = [];
    
    // Simple TypeScript/JavaScript entity detection
    if (language.includes('TypeScript') || language.includes('JavaScript')) {
      // Extract classes
      const classRegex = /(export\s+)?(abstract\s+)?(class)\s+([A-Za-z0-9_]+)/g;
      let match;
      
      while ((match = classRegex.exec(content)) !== null) {
        const classLine = lines.slice(0, match.index).filter(Boolean).length;
        entities.push({
          name: match[4],
          type: 'class',
          startLine: classLine,
          endLine: classLine + 20, // Approximate, would need better detection
          description: `Class ${match[4]}`,
        });
      }
      
      // Extract interfaces (TypeScript only)
      if (language.includes('TypeScript')) {
        const interfaceRegex = /(export\s+)?(interface)\s+([A-Za-z0-9_]+)/g;
        while ((match = interfaceRegex.exec(content)) !== null) {
          const interfaceLine = lines.slice(0, match.index).filter(Boolean).length;
          entities.push({
            name: match[3],
            type: 'interface',
            startLine: interfaceLine,
            endLine: interfaceLine + 10, // Approximate
            description: `Interface ${match[3]}`,
          });
        }
      }
      
      // Extract imports
      const importRegex = /import\s+(?:type\s+)?(?:{([^}]+)}|([A-Za-z0-9_]+))\s+from\s+['"]([^'"]+)['"]/g;
      while ((match = importRegex.exec(content)) !== null) {
        const importNames = match[1] ? match[1].split(',').map(s => s.trim()) : [match[2]];
        const importPath = match[3];
        
        for (const name of importNames) {
          if (name) {
            const isTypeImport = /import\s+type/.test(match[0]);
            imports.push({
              name,
              path: importPath,
              isType: isTypeImport
            });
          }
        }
      }
      
      // Extract exports
      const exportRegex = /export\s+(?:type\s+)?(?:{([^}]+)}|(?:(const|let|var|function|class|interface|enum|type)\s+([A-Za-z0-9_]+)))/g;
      while ((match = exportRegex.exec(content)) !== null) {
        if (match[1]) {
          // Named exports
          const exportNames = match[1].split(',').map(s => s.trim());
          for (const name of exportNames) {
            exports.push({
              name,
              type: 'unknown'
            });
          }
        } else if (match[2] && match[3]) {
          // Direct declaration exports
          exports.push({
            name: match[3],
            type: match[2]
          });
        }
      }
    }
    
    return {
      path: filePath,
      language,
      entities,
      imports,
      exports,
      lastModified: new Date(),
      contentHash: this.hashContent(content),
      lineCount: lines.length
    };
  }

  /**
   * Performs detailed analysis of a file using LLM
   * @param filePath Path to the file
   * @param content File content
   * @param language Programming language
   * @returns Analysis results
   */
  private async detailedAnalysis(filePath: string, content: string, language: string): Promise<CodeFile> {
    if (!this.llm) {
      logger.warn('LLM not available for detailed analysis, falling back to basic analysis');
      return this.basicAnalysis(filePath, content, language);
    }
    
    try {
      // Start with basic analysis results
      const basicResults = await this.basicAnalysis(filePath, content, language);
      
      // Create prompt for LLM
      const prompt = `Please analyze this ${language} code and provide a detailed structural analysis.
Include all functions, classes, interfaces, variables, and their relationships.
For each entity, include:
1. Name
2. Type (function, class, interface, etc.)
3. Start and end line numbers
4. Description
5. Parameters (for functions)
6. Return type (for functions)
7. Dependencies
8. Parent (if nested)

File: ${filePath}

\`\`\`${language}
${content}
\`\`\`

Provide the results in a structured JSON format.`;

      // Send to LLM for analysis
      const llmResponse = await this.llm.generate(prompt);
      
      try {
        // Parse LLM response
        const jsonStart = llmResponse.indexOf('{');
        const jsonEnd = llmResponse.lastIndexOf('}');
        
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonStr = llmResponse.substring(jsonStart, jsonEnd + 1);
          const analysis = JSON.parse(jsonStr);
          
          // Merge with basic results
          if (analysis.entities) {
            basicResults.entities = analysis.entities;
          }
          
          // Add any additional information from LLM analysis
          if (analysis.imports) {
            basicResults.imports = analysis.imports;
          }
          
          if (analysis.exports) {
            basicResults.exports = analysis.exports;
          }
        }
      } catch (parseError) {
        logger.warn('Failed to parse LLM analysis response:', parseError);
        // Continue with basic results
      }
      
      return basicResults;
    } catch (error) {
      logger.error('Error during detailed analysis:', error);
      // Fall back to basic analysis
      return this.basicAnalysis(filePath, content, language);
    }
  }

  /**
   * Creates a simple hash of content for change detection
   * @param content Content to hash
   * @returns Hash string
   */
  private hashContent(content: string): string {
    let hash = 0;
    if (content.length === 0) return hash.toString();
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString();
  }

  /**
   * Builds a dependency graph of files based on imports/exports
   */
  private buildDependencyGraph(): void {
    this.dependencyGraph.clear();
    
    // Initialize graph with all files
    for (const [filePath] of this.fileRegistry) {
      this.dependencyGraph.set(filePath, new Set());
    }
    
    // Add dependencies based on imports
    for (const [filePath, fileInfo] of this.fileRegistry) {
      const deps = this.dependencyGraph.get(filePath) || new Set();
      
      for (const importInfo of fileInfo.imports) {
        // Resolve import path to absolute path
        const resolvedPath = this.resolveImportPath(filePath, importInfo.path);
        if (resolvedPath && this.fileRegistry.has(resolvedPath)) {
          deps.add(resolvedPath);
        }
      }
      
      this.dependencyGraph.set(filePath, deps);
    }
    
    logger.info(`Built dependency graph for ${this.dependencyGraph.size} files`);
  }

  /**
   * Resolves an import path to an absolute file path
   * @param currentFile Current file path
   * @param importPath Import path
   * @returns Resolved absolute path
   */
  private resolveImportPath(currentFile: string, importPath: string): string | null {
    // This is a simplified implementation - a real implementation would 
    // handle TypeScript path mapping, node_modules, etc.
    
    try {
      // Handle relative imports
      if (importPath.startsWith('.')) {
        const dirName = path.dirname(currentFile);
        const absolutePath = path.resolve(dirName, importPath);
        
        // Try with different extensions
        const extensions = ['.ts', '.tsx', '.js', '.jsx'];
        
        // If path already has an extension
        if (path.extname(absolutePath)) {
          return absolutePath;
        }
        
        // Try different extensions
        for (const ext of extensions) {
          const pathWithExt = absolutePath + ext;
          if (this.fileRegistry.has(pathWithExt)) {
            return pathWithExt;
          }
        }
        
        // Try index files
        for (const ext of extensions) {
          const indexPath = path.join(absolutePath, `index${ext}`);
          if (this.fileRegistry.has(indexPath)) {
            return indexPath;
          }
        }
      }
      
      // For non-relative imports (node_modules, etc), return null
      // A more complete implementation would handle these
      return null;
    } catch (error) {
      logger.warn(`Failed to resolve import path ${importPath} in ${currentFile}:`, error);
      return null;
    }
  }

  /**
   * Generates a high-level context of the codebase for improved understanding
   */
  private async generateCodebaseContext(): Promise<void> {
    if (!this.llm || this.fileRegistry.size === 0) {
      this.codebaseContext = '';
      return;
    }
    
    try {
      // Prepare a summary of the codebase
      const summary = Array.from(this.fileRegistry.values()).map(file => {
        return `- ${file.path}: ${file.entities.length} entities, ${file.imports.length} imports, ${file.exports.length} exports`;
      }).join('\n');
      
      const prompt = `I have a codebase with ${this.fileRegistry.size} files. Here's a summary:
      
${summary}

Please provide a high-level overview of what this codebase likely does, its structure, 
and the main components. Focus on the architectural patterns and key relationships.`;
      
      this.codebaseContext = await this.llm.generate(prompt);
      logger.info('Generated codebase context');
    } catch (error) {
      logger.error('Failed to generate codebase context:', error);
      this.codebaseContext = '';
    }
  }

  /**
   * Finds dependent files (files that depend on the given file)
   * @param filePath Path to the file
   * @returns Array of dependent file paths
   */
  public findDependents(filePath: string): string[] {
    const dependents: string[] = [];
    
    for (const [path, deps] of this.dependencyGraph.entries()) {
      if (deps.has(filePath)) {
        dependents.push(path);
      }
    }
    
    return dependents;
  }

  /**
   * Finds dependencies of a file (files that the given file depends on)
   * @param filePath Path to the file
   * @returns Array of dependency file paths
   */
  public findDependencies(filePath: string): string[] {
    const deps = this.dependencyGraph.get(filePath);
    if (!deps) return [];
    
    return Array.from(deps);
  }

  /**
   * Analyzes the impact of changing a file
   * @param filePath Path to the file
   * @returns Impact analysis
   */
  public async analyzeImpact(filePath: string): Promise<{
    directDependents: string[];
    indirectDependents: string[];
    impactLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const directDependents = this.findDependents(filePath);
    const indirectDependents = new Set<string>();
    
    // Find indirect dependents (transitive dependencies)
    for (const dependent of directDependents) {
      const secondLevelDeps = this.findDependents(dependent);
      for (const dep of secondLevelDeps) {
        if (!directDependents.includes(dep) && dep !== filePath) {
          indirectDependents.add(dep);
        }
      }
    }
    
    // Determine impact level
    let impactLevel: 'low' | 'medium' | 'high' = 'low';
    if (directDependents.length > 10 || indirectDependents.size > 20) {
      impactLevel = 'high';
    } else if (directDependents.length > 3 || indirectDependents.size > 5) {
      impactLevel = 'medium';
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (impactLevel === 'high') {
      recommendations.push('Consider breaking down changes into smaller commits');
      recommendations.push('Write comprehensive tests for the modified components');
      recommendations.push('Plan for a thorough review process due to high impact');
    }
    
    if (directDependents.length > 0) {
      recommendations.push(`Test the following direct dependents: ${directDependents.slice(0, 3).join(', ')}${directDependents.length > 3 ? '...' : ''}`);
    }
    
    return {
      directDependents,
      indirectDependents: Array.from(indirectDependents),
      impactLevel,
      recommendations
    };
  }

  /**
   * Suggests changes or improvements to a file based on code analysis
   * @param filePath Path to the file
   * @returns Suggestions
   */
  public async suggestImprovements(filePath: string): Promise<string[]> {
    if (!this.llm) {
      return ['LLM not available for suggestions'];
    }
    
    try {
      const file = this.fileRegistry.get(filePath);
      if (!file) {
        return ['File not found in registry'];
      }
      
      const content = await fs.readFile(path.isAbsolute(filePath) ? filePath : path.join(this.config.baseDir, filePath), 'utf-8');
      
      const prompt = `Please analyze this ${file.language} code and suggest improvements:

\`\`\`${file.language}
${content}
\`\`\`

Focus on:
1. Code quality and maintainability
2. Performance optimizations
3. Type safety (if applicable)
4. Design patterns and architectural improvements
5. Potential bugs or edge cases

Provide practical, specific suggestions that could be implemented.`;
      
      const suggestions = await this.llm.generate(prompt);
      
      // Extract suggestions as a list
      return suggestions
        .split('\n')
        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*') || /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^[-*]\s*|^\d+\.\s*/, '').trim())
        .filter(Boolean);
    } catch (error) {
      logger.error(`Failed to generate suggestions for ${filePath}:`, error);
      return [`Error generating suggestions: ${error}`];
    }
  }

  /**
   * Provides context for a code change operation
   * @param filePath Path to the file
   * @returns Context information
   */
  public async getContextForChanges(filePath: string): Promise<{
    file: CodeFile | null;
    dependencies: string[];
    dependents: string[];
    relatedFiles: string[];
    codeContext: string;
  }> {
    const file = this.fileRegistry.get(filePath) || await this.analyzeFile(filePath);
    const dependencies = this.findDependencies(filePath);
    const dependents = this.findDependents(filePath);
    
    // Find related files (files with similar purpose or functionality)
    const relatedFiles: string[] = [];
    if (file) {
      // Look for files with similar exports
      for (const [otherPath, otherFile] of this.fileRegistry.entries()) {
        if (otherPath === filePath) continue;
        
        // Check for similar exports
        const exportNameOverlap = file.exports.some(e1 => 
          otherFile.exports.some(e2 => e2.name.includes(e1.name) || e1.name.includes(e2.name))
        );
        
        if (exportNameOverlap) {
          relatedFiles.push(otherPath);
        }
      }
    }
    
    // Generate code context
    let codeContext = '';
    if (this.llm && file) {
      try {
        const fileContent = await fs.readFile(path.isAbsolute(filePath) ? filePath : path.join(this.config.baseDir, filePath), 'utf-8');
        
        const prompt = `I'm working on making changes to this file. Please provide a concise summary 
of what this file does, its main components, and what to be careful about when modifying it:

File: ${filePath}

\`\`\`${file.language}
${fileContent}
\`\`\``;
        
        codeContext = await this.llm.generate(prompt);
      } catch (error) {
        logger.error(`Failed to generate code context for ${filePath}:`, error);
        codeContext = `Error generating context: ${error}`;
      }
    }
    
    return {
      file,
      dependencies,
      dependents,
      relatedFiles,
      codeContext
    };
  }

  /**
   * Updates the internal registry when a file is changed
   * @param filePath Path to the file
   * @param newContent New content of the file
   */
  public async updateFile(filePath: string, newContent: string): Promise<void> {
    try {
      // Reanalyze the file
      const fileInfo = await this.analyzeFile(filePath);
      if (fileInfo) {
        // Update registry
        this.fileRegistry.set(filePath, fileInfo);
        
        // Rebuild dependency graph
        this.buildDependencyGraph();
        
        logger.info(`Updated file in registry: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to update file ${filePath}:`, error);
    }
  }
} 