/**
 * Tree of Thought (ToT) implementation
 * 
 * This module provides the main TreeOfThought class that serves as the high-level
 * interface for using the Tree of Thought reasoning system.
 */

import type { LLMProvider } from '../types/llm';
import { logger } from '../utils/logger';
import { 
  ThoughtTree, 
  Strategy 
} from './base';
import type { ThoughtNode, ThoughtSolverConfig } from './base';
import { defaultThoughtSolverConfig } from './base';
import { createSolver, ThoughtSolverBase } from './solver';

/**
 * Options for the TreeOfThought system
 */
export interface TreeOfThoughtOptions {
  /**
   * The LLM provider to use
   */
  llm: LLMProvider;
  
  /**
   * The solving strategy to use
   */
  strategy?: Strategy;
  
  /**
   * Configuration for the thought solver
   */
  config?: Partial<ThoughtSolverConfig>;
  
  /**
   * Whether to log detailed information
   */
  verbose?: boolean;
}

/**
 * Main class for the Tree of Thought system
 * 
 * This class provides a high-level interface for using the Tree of Thought
 * reasoning system with different solving strategies.
 */
export class TreeOfThought {
  /**
   * The LLM provider
   */
  private llm: LLMProvider;
  
  /**
   * The solver instance
   */
  private solver: ThoughtSolverBase;
  
  /**
   * Whether to log detailed information
   */
  private verbose: boolean;

  /**
   * Create a new TreeOfThought instance
   * @param options - Options for the TreeOfThought system
   */
  constructor(options: TreeOfThoughtOptions) {
    this.llm = options.llm;
    this.verbose = options.verbose ?? false;
    
    const strategy = options.strategy ?? Strategy.BFS;
    this.solver = createSolver(strategy, this.llm, options.config);
    
    if (this.verbose) {
      logger.info(`Initialized TreeOfThought with strategy: ${strategy}`);
    }
  }

  /**
   * Solve a problem using Tree of Thought reasoning
   * @param prompt - The problem statement or initial prompt
   * @returns The solution
   */
  async solve(prompt: string): Promise<string> {
    if (this.verbose) {
      logger.info(`Solving problem with prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
    }
    
    try {
      const solution = await this.solver.solve(prompt);
      
      if (this.verbose) {
        logger.info(`Found solution with ${this.solver.thoughtTree.allNodes.length} nodes explored`);
      }
      
      return solution;
    } catch (error) {
      logger.error("Error solving problem with Tree of Thought:", error);
      throw error;
    }
  }

  /**
   * Get the thought tree from the solver
   * @returns The thought tree
   */
  getThoughtTree(): ThoughtTree {
    return this.solver.thoughtTree;
  }

  /**
   * Visualize the thought tree (simple console output)
   */
  visualize(): void {
    this.solver.thoughtTree.show();
  }
}

/**
 * Create a new TreeOfThought instance with the specified options
 * @param options - Options for the TreeOfThought system
 * @returns A new TreeOfThought instance
 */
export function createTreeOfThought(options: TreeOfThoughtOptions): TreeOfThought {
  return new TreeOfThought(options);
} 