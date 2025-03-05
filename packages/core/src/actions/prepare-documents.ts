/**
 * Prepare Documents Action
 * 
 * This action initializes project folder and adds new requirements to docs/requirements.txt.
 * It's used at the beginning of a project to set up the necessary structure.
 */

import path from 'path';
import fs from 'fs/promises';
import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import type { Document } from '../types/document';
import { DocumentImpl, RepoImpl } from '../types/document';
import { logger } from '../utils/logger';
import { ConfigManager } from '../config/config';
import { v4 as uuidv4 } from 'uuid';

/**
 * Requirement filename constant
 */
export const REQUIREMENT_FILENAME = 'docs/requirements.txt';

/**
 * PrepareDocuments Action configuration interface
 */
export interface PrepareDocumentsConfig extends ActionConfig {
  /**
   * Optional override for project path
   */
  projectPath?: string;
  
  /**
   * Optional override for project name
   */
  projectName?: string;
  
  /**
   * Whether to use incremental mode (don't delete existing folder)
   */
  incremental?: boolean;
}

/**
 * PrepareDocuments Action: initializes project folder and adds new requirements to docs/requirements.txt
 */
export class PrepareDocuments extends BaseAction {
  private config: PrepareDocumentsConfig;
  private repo: RepoImpl | null = null;
  
  /**
   * Creates a new PrepareDocuments action
   * @param config Action configuration
   */
  constructor(config: PrepareDocumentsConfig) {
    super({
      name: 'PrepareDocuments',
      description: 'Initialize project folder and add requirements',
      prefix: config.prefix,
      args: config.args,
      llm: config.llm,
      memory: config.memory,
      workingMemory: config.workingMemory
    });
    
    this.config = config;
    logger.debug(`PrepareDocuments initialized with config: ${JSON.stringify({
      projectPath: config.projectPath,
      projectName: config.projectName,
      incremental: config.incremental
    })}`);
  }
  
  /**
   * Initialize the repository
   * @returns Path to the initialized repository
   */
  private async initRepo(): Promise<string> {
    // Get global config
    const globalConfig = ConfigManager.getInstance().getConfig();
    
    // Determine project path
    let projectPath: string;
    if (this.config.projectPath) {
      projectPath = this.config.projectPath;
    } else {
      // Get workspace from global config or default to current directory
      const workspace = globalConfig.workspace?.storagePath || process.cwd();
      
      // Generate project name if not provided
      const projectName = this.config.projectName || 
                          globalConfig.projectName || 
                          `project-${uuidv4().substring(0, 8)}`;
      
      projectPath = path.join(workspace, projectName);
    }
    
    // Check if the directory exists
    try {
      const stats = await fs.stat(projectPath);
      
      // If directory exists and incremental mode is not enabled, remove it
      if (stats.isDirectory() && !this.config.incremental) {
        logger.info(`Removing existing directory: ${projectPath}`);
        await fs.rm(projectPath, { recursive: true, force: true });
      }
    } catch (error) {
      // Directory doesn't exist, which is fine
    }
    
    // Create the directory (and parents) if it doesn't exist
    logger.info(`Initializing project directory: ${projectPath}`);
    await fs.mkdir(projectPath, { recursive: true });
    
    // Initialize the repository
    this.repo = new RepoImpl({
      path: projectPath,
      name: path.basename(projectPath)
    });
    
    return projectPath;
  }
  
  /**
   * Run the PrepareDocuments action
   * @returns Action result containing the initialized document
   */
  async run(): Promise<ActionOutput> {
    try {
      logger.info(`Running PrepareDocuments action`);
      
      // Initialize the repository
      const projectPath = await this.initRepo();
      logger.info(`Project initialized at: ${projectPath}`);
      
      // Get the message content (requirements)
      const messageContent = this.getArg<string>('content') || '';
      
      if (!messageContent) {
        logger.warn('No content provided for requirements document');
      }
      
      // Create the docs directory if it doesn't exist
      const docsDir = path.join(projectPath, 'docs');
      await fs.mkdir(docsDir, { recursive: true });
      
      // Create and save the requirements document
      const requirementsPath = path.join(projectPath, REQUIREMENT_FILENAME);
      const requirementsDir = path.dirname(requirementsPath);
      await fs.mkdir(requirementsDir, { recursive: true });
      
      await fs.writeFile(requirementsPath, messageContent);
      
      // Create document object
      const document: Document = new DocumentImpl({
        content: messageContent,
        path: requirementsPath,
        name: REQUIREMENT_FILENAME,
      });
      
      logger.info(`Successfully created requirements document at: ${requirementsPath}`);
      
      return this.createOutput(
        messageContent,
        'completed',
        document
      );
    } catch (error) {
      logger.error(`Error in PrepareDocuments action: ${error}`);
      await this.handleException(error as Error);
      return this.createOutput(
        `Failed to prepare documents: ${error}`,
        'failed'
      );
    }
  }
} 