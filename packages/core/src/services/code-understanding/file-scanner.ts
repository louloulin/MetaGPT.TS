/**
 * @module FileScanner
 * @category Services
 * @description Provides file scanning utilities for the code understanding system
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import * as glob from 'glob';
import { promisify } from 'util';

// Promisify glob pattern matching
const globPromise = promisify(glob);

/**
 * Configuration for the file scanner
 */
export interface FileScannerConfig {
  /** Base directory to scan */
  baseDir: string;
  /** File patterns to include */
  include: string[];
  /** File patterns to exclude */
  exclude: string[];
  /** Maximum file size in bytes (files larger than this will be skipped) */
  maxFileSize?: number;
}

/**
 * Result of a file scan operation
 */
export interface FileScanResult {
  /** List of discovered file paths */
  files: string[];
  /** Statistics about the scan */
  stats: {
    /** Total number of files found */
    totalFiles: number;
    /** Number of files that were too large to process */
    oversizedFiles: number;
    /** Number of files that were skipped due to errors */
    errorFiles: number;
    /** Number of files that were skipped due to exclusion patterns */
    excludedFiles: number;
    /** Time taken to scan in milliseconds */
    scanTimeMs: number;
  };
}

/**
 * FileScanner provides utilities for scanning directories and discovering code files
 */
export class FileScanner {
  private config: FileScannerConfig;
  
  /**
   * Creates a new FileScanner
   * @param config Scanner configuration
   */
  constructor(config: FileScannerConfig) {
    this.config = {
      ...config,
      // Default max file size: 1MB
      maxFileSize: config.maxFileSize || 1024 * 1024,
    };
    
    logger.debug(`FileScanner initialized with base directory: ${this.config.baseDir}`);
  }
  
  /**
   * Scans the configured directory for matching files
   * @returns Scan results
   */
  public async scan(): Promise<FileScanResult> {
    const startTime = Date.now();
    logger.info(`Starting file scan in ${this.config.baseDir}`);
    
    const result: FileScanResult = {
      files: [],
      stats: {
        totalFiles: 0,
        oversizedFiles: 0,
        errorFiles: 0,
        excludedFiles: 0,
        scanTimeMs: 0,
      },
    };
    
    try {
      // Find files matching include patterns
      const includedFiles: Set<string> = new Set();
      for (const pattern of this.config.include) {
        const matches = await globPromise(pattern, {
          cwd: this.config.baseDir,
          absolute: true,
          ignore: this.config.exclude,
          nodir: true,
        });
        
        for (const match of matches) {
          includedFiles.add(match);
        }
      }
      
      // Process each file
      for (const filePath of includedFiles) {
        try {
          const stats = await fs.stat(filePath);
          
          // Skip files that are too large
          if (stats.size > this.config.maxFileSize!) {
            logger.warn(`Skipping oversized file: ${filePath} (${stats.size} bytes)`);
            result.stats.oversizedFiles++;
            continue;
          }
          
          // Add file to the result list
          result.files.push(filePath);
        } catch (error) {
          logger.error(`Error processing file ${filePath}:`, error);
          result.stats.errorFiles++;
        }
      }
      
      // Calculate statistics
      result.stats.totalFiles = result.files.length;
      result.stats.scanTimeMs = Date.now() - startTime;
      
      logger.info(`File scan completed in ${result.stats.scanTimeMs}ms, found ${result.stats.totalFiles} files`);
      
      if (result.stats.oversizedFiles > 0) {
        logger.warn(`Skipped ${result.stats.oversizedFiles} oversized files`);
      }
      
      if (result.stats.errorFiles > 0) {
        logger.warn(`Encountered errors in ${result.stats.errorFiles} files`);
      }
      
      return result;
    } catch (error) {
      logger.error('Error during file scan:', error);
      result.stats.scanTimeMs = Date.now() - startTime;
      return result;
    }
  }
  
  /**
   * Checks if a file is eligible for scanning
   * @param filePath Path to the file
   * @returns True if the file should be included, false otherwise
   */
  public async isEligibleFile(filePath: string): Promise<boolean> {
    try {
      // Check if file matches exclude patterns
      for (const pattern of this.config.exclude) {
        if (glob.hasMagic(pattern)) {
          // For patterns with wildcards
          const isExcluded = await globPromise(pattern, {
            cwd: this.config.baseDir,
            absolute: true,
          }).then(matches => matches.includes(filePath));
          
          if (isExcluded) {
            return false;
          }
        } else {
          // For simple path comparisons
          if (filePath.includes(pattern)) {
            return false;
          }
        }
      }
      
      // Check if file matches include patterns
      for (const pattern of this.config.include) {
        if (glob.hasMagic(pattern)) {
          // For patterns with wildcards
          const isIncluded = await globPromise(pattern, {
            cwd: this.config.baseDir,
            absolute: true,
          }).then(matches => matches.includes(filePath));
          
          if (isIncluded) {
            // Check file size
            const stats = await fs.stat(filePath);
            return stats.size <= this.config.maxFileSize!;
          }
        } else {
          // For simple path comparisons
          if (filePath.endsWith(pattern.replace('*', ''))) {
            // Check file size
            const stats = await fs.stat(filePath);
            return stats.size <= this.config.maxFileSize!;
          }
        }
      }
      
      return false;
    } catch (error) {
      logger.error(`Error checking file eligibility for ${filePath}:`, error);
      return false;
    }
  }
  
  /**
   * Gets file content and basic info
   * @param filePath Path to the file
   * @returns File content and info, or null if there's an error
   */
  public async getFileInfo(filePath: string): Promise<{
    path: string;
    content: string;
    size: number;
    lastModified: Date;
  } | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      
      return {
        path: filePath,
        content,
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error) {
      logger.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Watch for file changes in the configured directory
   * @param callback Function to call when files change
   * @returns Function to stop watching
   */
  public async watchFiles(callback: (event: 'add' | 'change' | 'unlink', filePath: string) => void): Promise<() => void> {
    logger.info(`File watching not implemented yet, would watch ${this.config.baseDir}`);
    
    // This would normally use fs.watch or a library like chokidar
    // For now, just return a no-op function
    return () => {
      logger.info('File watching stopped');
    };
  }
} 