/**
 * Base classes for the Tree of Thought implementation
 * 
 * This module provides the foundational classes for implementing the Tree of Thought
 * reasoning framework, including base parsers, evaluators, and tree data structures.
 */

import { z } from 'zod';

/**
 * Base parser interface for handling thought generation prompts
 */
export interface BaseParser {
  /**
   * Generate a prompt for proposing new thoughts based on current state
   * @param currentState - The current reasoning state
   * @param options - Additional options for prompt generation
   * @returns A string prompt for the LLM
   */
  propose(currentState: string, options?: Record<string, any>): string;

  /**
   * Generate a prompt for sampling thoughts
   * @param currentState - The current reasoning state
   * @param options - Additional options for prompt generation
   * @returns A string prompt for the LLM
   */
  sample(currentState: string, options?: Record<string, any>): string;

  /**
   * Generate a prompt for evaluating a thought
   * @param input - The thought to evaluate
   * @param options - Additional options for evaluation
   * @returns A string prompt for the LLM
   */
  value(input: string, options?: Record<string, any>): string;
}

/**
 * Default implementation of BaseParser that uses simple prompts
 */
export class DefaultParser implements BaseParser {
  /**
   * @inheritdoc
   */
  propose(currentState: string, options?: Record<string, any>): string {
    const nGenerateSample = options?.n_generate_sample || 5;
    return `Given the current state of reasoning: "${currentState}", generate ${nGenerateSample} possible next steps or thoughts that could lead to a solution. Be diverse and creative in your proposals.`;
  }

  /**
   * @inheritdoc
   */
  sample(currentState: string, options?: Record<string, any>): string {
    return `Given the current state of reasoning: "${currentState}", provide a sample continuation or next thought that is most likely to be productive.`;
  }

  /**
   * @inheritdoc
   */
  value(input: string, options?: Record<string, any>): string {
    const nodeId = options?.node_id || "";
    return `Evaluate the following thought on a scale from 0 to 10, where 0 is completely irrelevant or incorrect and 10 is extremely valuable and directly leads to solving the problem.
Thought ${nodeId}: "${input}"
Provide your evaluation as a single number followed by a brief explanation.`;
  }
}

/**
 * Base evaluator interface for assessing thought quality
 */
export interface BaseEvaluator {
  /**
   * Evaluate the quality of a thought
   * @param evaluation - The evaluation text from the LLM
   * @param options - Additional evaluation options
   * @returns A numerical score for the thought
   */
  evaluate(evaluation: string, options?: Record<string, any>): number;

  /**
   * Determine if a thought is valid based on its value
   * @param value - The numerical value of the thought
   * @param options - Additional validation options
   * @returns A boolean indicating if the thought is valid
   */
  statusVerify(value: number, options?: Record<string, any>): boolean;
}

/**
 * Default implementation of BaseEvaluator that extracts scores from LLM responses
 */
export class DefaultEvaluator implements BaseEvaluator {
  /**
   * Minimum threshold for a thought to be considered valid
   */
  validThreshold: number = 3;

  /**
   * @inheritdoc
   */
  constructor(validThreshold: number = 3) {
    this.validThreshold = validThreshold;
  }

  /**
   * @inheritdoc
   */
  evaluate(evaluation: string, options?: Record<string, any>): number {
    // Try to extract a numerical value from the evaluation
    const match = evaluation.match(/^(\d+(\.\d+)?)/);
    if (match && match[1]) {
      const score = parseFloat(match[1]);
      if (!isNaN(score) && score >= 0 && score <= 10) {
        return score;
      }
    }
    // If no valid score is found, return a default low score
    return 1;
  }

  /**
   * @inheritdoc
   */
  statusVerify(value: number, options?: Record<string, any>): boolean {
    return value >= this.validThreshold;
  }
}

/**
 * A node representing a thought in the thought tree
 */
export class ThoughtNode {
  /**
   * The content of the thought
   */
  name: string;
  
  /**
   * The numerical value/score of the thought
   */
  value: number;
  
  /**
   * Unique identifier for the thought
   */
  id: number;
  
  /**
   * Whether the thought is valid for further exploration
   */
  validStatus: boolean;
  
  /**
   * Reference to the parent thought node
   */
  parent: ThoughtNode | null;
  
  /**
   * Child thought nodes
   */
  children: ThoughtNode[];

  /**
   * Create a new thought node
   * @param name - The content of the thought
   * @param parent - The parent thought node
   * @param id - Unique identifier for the thought
   */
  constructor(name: string, parent: ThoughtNode | null = null, id: number = 0) {
    this.name = name;
    this.value = 0;
    this.id = id;
    this.validStatus = true;
    this.parent = parent;
    this.children = [];

    // Add this node as a child of the parent node
    if (parent) {
      parent.children.push(this);
    }
  }

  /**
   * Update the value of the thought node
   * @param value - The new value
   */
  updateValue(value: number): void {
    this.value = value;
  }

  /**
   * Update the validity status of the thought node
   * @param status - The new validity status
   */
  updateValidStatus(status: boolean): void {
    this.validStatus = status;
  }
}

/**
 * A tree structure to represent thoughts and their relationships
 */
export class ThoughtTree {
  /**
   * The root node of the tree
   */
  root: ThoughtNode | null;

  /**
   * Create a new thought tree
   * @param root - The root thought node
   */
  constructor(root: ThoughtNode | null = null) {
    this.root = root;
  }

  /**
   * Get all nodes in the tree
   * @returns All nodes in the tree
   */
  get allNodes(): ThoughtNode[] {
    if (!this.root) return [];
    return this.getAllNodesRecursive(this.root);
  }

  /**
   * Recursively collect all nodes in the tree
   * @param node - The current node
   * @param nodes - The collected nodes so far
   * @returns All nodes in the subtree
   */
  private getAllNodesRecursive(node: ThoughtNode, nodes: ThoughtNode[] = []): ThoughtNode[] {
    nodes.push(node);
    for (const child of node.children) {
      this.getAllNodesRecursive(child, nodes);
    }
    return nodes;
  }

  /**
   * Update the tree with new thoughts
   * @param thoughts - Information about new thoughts
   * @param currentNode - The parent node for the new thoughts
   * @returns The newly created thought nodes
   */
  updateNode(thoughts: Array<{ node_id: string; node_state_instruction: string }>, currentNode: ThoughtNode | null = null): ThoughtNode[] {
    const nodes: ThoughtNode[] = [];
    for (const nodeInfo of thoughts) {
      const node = new ThoughtNode(
        nodeInfo.node_state_instruction,
        currentNode,
        parseInt(nodeInfo.node_id)
      );
      nodes.push(node);
    }
    return nodes;
  }

  /**
   * Parse and retrieve the hierarchical path of the given thought node
   * @param node - The thought node to parse
   * @returns The full path from root to the node
   */
  parseNodePath(node: ThoughtNode): string[] {
    const fullNodePath: string[] = [];
    let currentNode: ThoughtNode | null = node;
    
    while (currentNode !== null) {
      fullNodePath.push(currentNode.name);
      currentNode = currentNode.parent;
    }
    
    return fullNodePath.reverse();
  }

  /**
   * Print the tree structure
   */
  show(): void {
    console.log("\nUpdated Tree:");
    if (!this.root) {
      console.log("Empty tree");
      return;
    }
    
    this.showNodeRecursive(this.root, "");
  }

  /**
   * Recursively print the tree structure
   * @param node - The current node
   * @param prefix - The prefix for indentation
   */
  private showNodeRecursive(node: ThoughtNode, prefix: string): void {
    console.log(`${prefix}${node.name}, value: ${node.value}, valid_status: ${node.validStatus}`);
    for (const child of node.children) {
      this.showNodeRecursive(child, prefix + "  ");
    }
  }
}

/**
 * Enum for thought node selection methods
 */
export enum MethodSelect {
  SAMPLE = "sample",
  GREEDY = "greedy"
}

/**
 * Enum for Tree of Thought search strategies
 */
export enum Strategy {
  BFS = "BFS",
  DFS = "DFS",
  MCTS = "MCTS"
}

/**
 * Configuration for the thought solver
 */
export interface ThoughtSolverConfig {
  /**
   * Maximum number of reasoning steps
   */
  maxSteps: number;
  
  /**
   * Method for selecting nodes
   */
  methodSelect: MethodSelect;
  
  /**
   * Number of samples to generate per node
   */
  nGenerateSample: number;
  
  /**
   * Number of samples to select per path
   */
  nSelectSample: number;
  
  /**
   * Number of solution samples for DFS
   */
  nSolutionSample: number;
  
  /**
   * Parser for generating thought prompts
   */
  parser: BaseParser;
  
  /**
   * Evaluator for assessing thought quality
   */
  evaluator: BaseEvaluator;
}

/**
 * Default configuration for the thought solver
 */
export const defaultThoughtSolverConfig: ThoughtSolverConfig = {
  maxSteps: 3,
  methodSelect: MethodSelect.GREEDY,
  nGenerateSample: 5,
  nSelectSample: 3,
  nSolutionSample: 5,
  parser: new DefaultParser(),
  evaluator: new DefaultEvaluator(3)
}; 