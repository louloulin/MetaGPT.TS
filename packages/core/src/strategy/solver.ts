/**
 * Tree of Thought solver implementations
 * 
 * This module provides the implementation of different Tree of Thought solving strategies,
 * including BFS, DFS, and MCTS approaches.
 */

import type { LLMProvider } from '../types/llm';
import { 
  ThoughtNode, 
  ThoughtTree, 
  MethodSelect,
  Strategy
} from './base';
import type { ThoughtSolverConfig } from './base';
import { defaultThoughtSolverConfig } from './base';
import { logger } from '../utils/logger';

// Output format for LLM responses
const OUTPUT_FORMAT = `
Each output should be strictly a list of nodes, in json format, like this:
\`\`\`json
    [
        {
            "node_id": str = "unique identifier for a solution, can be an ordinal",
            "node_state_instruction": "specified sample of solution",
        },
        ...
    ]
\`\`\`
`;

/**
 * Base class for thought solvers
 */
export abstract class ThoughtSolverBase {
  /**
   * The thought tree being explored
   */
  thoughtTree: ThoughtTree;
  
  /**
   * The LLM provider for generating and evaluating thoughts
   */
  llm: LLMProvider;
  
  /**
   * Configuration for the solver
   */
  config: ThoughtSolverConfig;

  /**
   * Create a new thought solver
   * @param llm - The LLM provider
   * @param config - Configuration for the solver
   */
  constructor(llm: LLMProvider, config: Partial<ThoughtSolverConfig> = {}) {
    this.thoughtTree = new ThoughtTree();
    this.llm = llm;
    this.config = { ...defaultThoughtSolverConfig, ...config };
  }

  /**
   * Solve a problem using Tree of Thought
   * @param initPrompt - The initial problem statement
   * @returns The solution
   */
  abstract solve(initPrompt: string): Promise<string>;

  /**
   * Generate child thoughts based on the current state
   * @param currentState - The current reasoning state
   * @param currentNode - The current node in the thought tree
   * @returns List of nodes representing the generated thoughts
   */
  async generateThoughts(currentState: string = "", currentNode: ThoughtNode | null = null): Promise<ThoughtNode[]> {
    try {
      const statePrompt = this.config.parser.propose(
        currentState, 
        { n_generate_sample: this.config.nGenerateSample }
      );
      
      const response = await this.llm.chat(statePrompt + "\n" + OUTPUT_FORMAT);
      
      // Extract JSON from the response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch || !jsonMatch[1]) {
        logger.error("Failed to parse JSON from LLM response");
        return [];
      }
      
      const thoughts = JSON.parse(jsonMatch[1]);
      
      // Limit the number of thoughts to nGenerateSample
      const validThoughts = thoughts.slice(0, this.config.nGenerateSample);
      
      return this.thoughtTree.updateNode(validThoughts, currentNode);
    } catch (error) {
      logger.error("Error generating thoughts:", error);
      return [];
    }
  }

  /**
   * Evaluate a node and update its status and value
   * @param node - The node to evaluate
   * @param parentValue - The parent node's value
   */
  async evaluateNode(node: ThoughtNode, parentValue: number): Promise<void> {
    try {
      const evalPrompt = this.config.parser.value(node.name, { node_id: node.id });
      const evaluation = await this.llm.chat(evalPrompt);
      
      const value = this.config.evaluator.evaluate(evaluation, { node_id: node.id });
      const status = this.config.evaluator.statusVerify(value);
      
      node.updateValidStatus(status);
      // Accumulate score
      node.updateValue(parentValue + value);
    } catch (error) {
      logger.error("Error evaluating node:", error);
      // Set a default low value on error
      node.updateValidStatus(false);
      node.updateValue(parentValue);
    }
  }

  /**
   * Select nodes based on the configured selection method
   * @param thoughtNodes - List of nodes to select from
   * @returns Selected nodes
   */
  selectNodes(thoughtNodes: ThoughtNode[]): ThoughtNode[] {
    if (thoughtNodes.length === 0) return [];
    
    // Filter valid nodes
    const validNodes = thoughtNodes.filter(node => node.validStatus);
    if (validNodes.length === 0) return [];
    
    // Sort by value in descending order
    const sortedNodes = [...validNodes].sort((a, b) => b.value - a.value);
    
    if (this.config.methodSelect === MethodSelect.GREEDY) {
      // Take the top n nodes
      return sortedNodes.slice(0, this.config.nSelectSample);
    } else {
      // Sample randomly, weighted by value
      const selectedNodes: ThoughtNode[] = [];
      const totalValue = sortedNodes.reduce((sum, node) => sum + node.value, 0);
      
      for (let i = 0; i < this.config.nSelectSample && i < sortedNodes.length; i++) {
        // Simple weighted random selection
        let randomValue = Math.random() * totalValue;
        let cumulativeValue = 0;
        
        for (const node of sortedNodes) {
          if (selectedNodes.includes(node)) continue;
          
          cumulativeValue += node.value;
          if (cumulativeValue >= randomValue) {
            selectedNodes.push(node);
            break;
          }
        }
        
        // Fallback if no node was selected
        if (selectedNodes.length <= i && sortedNodes.length > i) {
          selectedNodes.push(sortedNodes[i]);
        }
      }
      
      return selectedNodes;
    }
  }
}

/**
 * Breadth-First Search solver for Tree of Thought
 */
export class BFSSolver extends ThoughtSolverBase {
  /**
   * Solve a problem using BFS strategy
   * @param initPrompt - The initial problem statement
   * @returns The solution
   */
  async solve(initPrompt: string): Promise<string> {
    logger.info("Solving with BFS strategy");
    
    // Create root node
    const rootNode = new ThoughtNode(initPrompt);
    this.thoughtTree = new ThoughtTree(rootNode);
    
    // BFS queue
    let queue: ThoughtNode[] = [rootNode];
    let step = 0;
    
    while (queue.length > 0 && step < this.config.maxSteps) {
      logger.info(`BFS Step ${step + 1}/${this.config.maxSteps}`);
      const levelSize = queue.length;
      const nextQueue: ThoughtNode[] = [];
      
      // Process all nodes at the current level
      for (let i = 0; i < levelSize; i++) {
        const currentNode = queue[i];
        
        // Generate child thoughts
        const childNodes = await this.generateThoughts(currentNode.name, currentNode);
        
        // Evaluate each child node
        for (const childNode of childNodes) {
          await this.evaluateNode(childNode, currentNode.value);
        }
        
        // Select the best nodes to continue exploration
        const selectedNodes = this.selectNodes(childNodes);
        nextQueue.push(...selectedNodes);
      }
      
      // Update queue for next level
      queue = nextQueue;
      step++;
    }
    
    // Find the best leaf node
    const leafNodes = this.thoughtTree.allNodes.filter(
      node => node.children.length === 0 && node !== rootNode
    );
    
    if (leafNodes.length === 0) {
      return initPrompt; // Return the initial prompt if no solution was found
    }
    
    // Sort leaf nodes by value and return the best one
    const bestNode = leafNodes.sort((a, b) => b.value - a.value)[0];
    const solutionPath = this.thoughtTree.parseNodePath(bestNode);
    
    return solutionPath.join("\n");
  }
}

/**
 * Depth-First Search solver for Tree of Thought
 */
export class DFSSolver extends ThoughtSolverBase {
  /**
   * Solve a problem using DFS strategy
   * @param initPrompt - The initial problem statement
   * @returns The solution
   */
  async solve(initPrompt: string): Promise<string> {
    logger.info("Solving with DFS strategy");
    
    // Create root node
    const rootNode = new ThoughtNode(initPrompt);
    this.thoughtTree = new ThoughtTree(rootNode);
    
    // Track the best solution found so far
    let bestSolution: { node: ThoughtNode; value: number } = { 
      node: rootNode, 
      value: 0 
    };
    
    // Perform DFS
    await this.dfs(rootNode, 0, bestSolution);
    
    // Return the best solution path
    const solutionPath = this.thoughtTree.parseNodePath(bestSolution.node);
    return solutionPath.join("\n");
  }
  
  /**
   * Recursive DFS exploration
   * @param node - Current node
   * @param depth - Current depth
   * @param bestSolution - Reference to the best solution found so far
   */
  private async dfs(
    node: ThoughtNode, 
    depth: number, 
    bestSolution: { node: ThoughtNode; value: number }
  ): Promise<void> {
    // Stop if we've reached the maximum depth
    if (depth >= this.config.maxSteps) {
      // Update best solution if this leaf is better
      if (node.value > bestSolution.value) {
        bestSolution.node = node;
        bestSolution.value = node.value;
      }
      return;
    }
    
    // Generate child thoughts
    const childNodes = await this.generateThoughts(node.name, node);
    
    // Evaluate each child node
    for (const childNode of childNodes) {
      await this.evaluateNode(childNode, node.value);
    }
    
    // Select the best nodes to continue exploration
    const selectedNodes = this.selectNodes(childNodes);
    
    // If no valid children, treat as leaf
    if (selectedNodes.length === 0) {
      if (node.value > bestSolution.value) {
        bestSolution.node = node;
        bestSolution.value = node.value;
      }
      return;
    }
    
    // Recursively explore selected nodes
    for (const childNode of selectedNodes) {
      await this.dfs(childNode, depth + 1, bestSolution);
    }
  }
}

/**
 * Monte Carlo Tree Search solver for Tree of Thought
 */
export class MCTSSolver extends ThoughtSolverBase {
  /**
   * Solve a problem using MCTS strategy
   * @param initPrompt - The initial problem statement
   * @returns The solution
   */
  async solve(initPrompt: string): Promise<string> {
    logger.info("Solving with MCTS strategy");
    
    // Create root node
    const rootNode = new ThoughtNode(initPrompt);
    this.thoughtTree = new ThoughtTree(rootNode);
    
    // Number of MCTS iterations
    const numIterations = this.config.maxSteps * this.config.nGenerateSample;
    
    for (let i = 0; i < numIterations; i++) {
      logger.info(`MCTS Iteration ${i + 1}/${numIterations}`);
      
      // Selection and expansion
      const selectedNode = await this.selectAndExpand(rootNode);
      
      // Simulation
      const simulationValue = await this.simulate(selectedNode);
      
      // Backpropagation
      this.backpropagate(selectedNode, simulationValue);
    }
    
    // Find the best path
    const bestNode = this.findBestNode(rootNode);
    const solutionPath = this.thoughtTree.parseNodePath(bestNode);
    
    return solutionPath.join("\n");
  }
  
  /**
   * Select a node to expand using UCB1 formula
   * @param rootNode - The root node
   * @returns The selected node
   */
  private async selectAndExpand(rootNode: ThoughtNode): Promise<ThoughtNode> {
    let currentNode = rootNode;
    
    // Selection phase - traverse the tree using UCB1
    while (currentNode.children.length > 0) {
      // If not all children have been evaluated, select an unevaluated child
      const unevaluatedChildren = currentNode.children.filter(child => child.value === 0);
      if (unevaluatedChildren.length > 0) {
        currentNode = unevaluatedChildren[0];
        break;
      }
      
      // Otherwise, use UCB1 to select the best child
      currentNode = this.selectUCB1(currentNode);
    }
    
    // Expansion phase - if the selected node has not been expanded and is not a terminal node
    if (currentNode.children.length === 0 && currentNode.validStatus) {
      // Generate child thoughts
      const childNodes = await this.generateThoughts(currentNode.name, currentNode);
      
      // Evaluate each child node
      for (const childNode of childNodes) {
        await this.evaluateNode(childNode, 0); // Start with 0 for MCTS
      }
      
      // If children were generated, select one of them
      if (childNodes.length > 0) {
        currentNode = childNodes[0];
      }
    }
    
    return currentNode;
  }
  
  /**
   * Select the best child node using UCB1 formula
   * @param node - The parent node
   * @returns The selected child node
   */
  private selectUCB1(node: ThoughtNode): ThoughtNode {
    const totalVisits = node.children.reduce((sum, child) => sum + child.value, 0);
    const C = Math.sqrt(2); // Exploration parameter
    
    let bestChild = node.children[0];
    let bestUCB1 = -Infinity;
    
    for (const child of node.children) {
      if (!child.validStatus) continue;
      
      // UCB1 formula: value/visits + C * sqrt(ln(totalVisits)/visits)
      const visits = Math.max(child.value, 1); // Avoid division by zero
      const exploitation = child.value / visits;
      const exploration = C * Math.sqrt(Math.log(totalVisits) / visits);
      const ucb1 = exploitation + exploration;
      
      if (ucb1 > bestUCB1) {
        bestUCB1 = ucb1;
        bestChild = child;
      }
    }
    
    return bestChild;
  }
  
  /**
   * Simulate a random playout from the given node
   * @param node - The starting node
   * @returns The simulation value
   */
  private async simulate(node: ThoughtNode): Promise<number> {
    // For simplicity, we'll use the node's current value as the simulation result
    // In a more sophisticated implementation, we could perform a random playout
    return node.value;
  }
  
  /**
   * Backpropagate the simulation result up the tree
   * @param node - The leaf node
   * @param value - The simulation value
   */
  private backpropagate(node: ThoughtNode, value: number): void {
    let currentNode: ThoughtNode | null = node;
    
    while (currentNode !== null) {
      // Increment the node's value (used as visit count in MCTS)
      currentNode.updateValue(currentNode.value + value);
      currentNode = currentNode.parent;
    }
  }
  
  /**
   * Find the best node from the root based on visit count
   * @param rootNode - The root node
   * @returns The best node
   */
  private findBestNode(rootNode: ThoughtNode): ThoughtNode {
    if (rootNode.children.length === 0) {
      return rootNode;
    }
    
    // Find the child with the highest visit count
    let bestChild = rootNode.children[0];
    let bestValue = bestChild.value;
    
    for (const child of rootNode.children) {
      if (child.value > bestValue) {
        bestValue = child.value;
        bestChild = child;
      }
    }
    
    // Recursively find the best node in the subtree
    return this.findBestNode(bestChild);
  }
}

/**
 * Factory function to create a solver based on the specified strategy
 * @param strategy - The solving strategy to use
 * @param llm - The LLM provider
 * @param config - Configuration for the solver
 * @returns The appropriate solver instance
 */
export function createSolver(
  strategy: Strategy, 
  llm: LLMProvider, 
  config: Partial<ThoughtSolverConfig> = {}
): ThoughtSolverBase {
  switch (strategy) {
    case Strategy.BFS:
      return new BFSSolver(llm, config);
    case Strategy.DFS:
      return new DFSSolver(llm, config);
    case Strategy.MCTS:
      return new MCTSSolver(llm, config);
    default:
      logger.warn(`Unknown strategy: ${strategy}, defaulting to BFS`);
      return new BFSSolver(llm, config);
  }
} 