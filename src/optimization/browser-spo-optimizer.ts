import { v4 as uuidv4 } from 'uuid';
import WorkerManager, { WorkerTaskType, TaskPriority } from '../browser/worker-manager';
import type { TaskInput, TaskResult } from '../browser/worker-manager';
import { logger } from '../utils/logger';

/**
 * Objective function type for SPO optimization
 */
export type ObjectiveFunction = (solution: number[]) => number | Promise<number>;

/**
 * Constraint function type
 */
export type ConstraintFunction = (solution: number[]) => boolean | Promise<boolean>;

/**
 * Solution type for optimization result
 */
export interface Solution {
  parameters: number[];
  value: number;
  iteration: number;
  feasible: boolean;
}

/**
 * Bounds for optimization parameters
 */
export interface ParameterBounds {
  min: number[];
  max: number[];
}

/**
 * Options for SPO optimizer
 */
export interface SPOOptimizerOptions {
  /**
   * Maximum number of iterations
   * Default: 100
   */
  maxIterations?: number;
  
  /**
   * Population size for evolutionary algorithms
   * Default: 50
   */
  populationSize?: number;
  
  /**
   * Mutation rate for genetic algorithm component
   * Default: 0.1
   */
  mutationRate?: number;
  
  /**
   * Crossover rate for genetic algorithm component
   * Default: 0.7
   */
  crossoverRate?: number;
  
  /**
   * Convergence threshold
   * Default: 1e-6
   */
  convergenceThreshold?: number;
  
  /**
   * Number of workers to use
   * Default: navigator.hardwareConcurrency || 2
   */
  numWorkers?: number;
  
  /**
   * Whether to use WebWorkers (if available)
   * Default: true
   */
  useWorkers?: boolean;
  
  /**
   * Enable caching of previous evaluations
   * Default: true
   */
  enableCache?: boolean;
  
  /**
   * Cache size limit
   * Default: 10000
   */
  maxCacheSize?: number;
  
  /**
   * Progress callback interval in milliseconds
   * Default: 100
   */
  progressInterval?: number;
  
  /**
   * Algorithm type: 'genetic', 'particle-swarm', 'hybrid'
   * Default: 'hybrid'
   */
  algorithmType?: 'genetic' | 'particle-swarm' | 'hybrid';
}

/**
 * Progress update event
 */
export interface OptimizationProgressEvent {
  iteration: number;
  bestSolution: Solution;
  currentPopulation: Solution[];
  timeElapsed: number;
  estimatedTimeRemaining?: number;
}

/**
 * Type for progress callback
 */
export type ProgressCallback = (progress: OptimizationProgressEvent) => void;

/**
 * Optimization result
 */
export interface OptimizationResult {
  bestSolution: Solution;
  allSolutions: Solution[];
  iterations: number;
  timeElapsed: number;
  terminated: boolean;
  terminationReason?: string;
}

/**
 * Cache entry for objective function evaluations
 */
interface CacheEntry {
  parameters: string; // JSON stringified parameters
  value: number;
  timestamp: number;
}

/**
 * Browser-compatible SPO (Spatial-Physical-Objective) Optimizer
 * 
 * Features:
 * - WebWorker support for non-blocking optimization
 * - Hybrid algorithm combining genetic algorithms with particle swarm optimization
 * - Support for constraints and multi-dimensional parameter spaces
 * - Progress tracking and cancellation
 * - Result caching for improved performance
 */
export class BrowserSPOOptimizer {
  private options: Required<SPOOptimizerOptions>;
  private workerManager?: WorkerManager;
  private objectiveFunction: ObjectiveFunction;
  private constraints: ConstraintFunction[];
  private bounds: ParameterBounds;
  private cache: Map<string, CacheEntry>;
  private isRunning: boolean = false;
  private isCancelled: boolean = false;
  private iterationCount: number = 0;
  private bestSolution: Solution | null = null;
  private startTime: number = 0;
  private progressTimer?: number;
  private progressCallback?: ProgressCallback;
  private currentPopulation: Solution[] = [];
  private paramDimension: number;
  
  /**
   * Create a new BrowserSPOOptimizer
   * 
   * @param objectiveFunction Function to minimize
   * @param bounds Parameter bounds { min: number[], max: number[] }
   * @param constraints Optional constraint functions
   * @param options Optimizer options
   */
  constructor(
    objectiveFunction: ObjectiveFunction,
    bounds: ParameterBounds,
    constraints: ConstraintFunction[] = [],
    options: SPOOptimizerOptions = {}
  ) {
    this.objectiveFunction = objectiveFunction;
    this.constraints = constraints;
    this.bounds = bounds;
    this.cache = new Map();
    
    // Validate bounds
    if (!Array.isArray(bounds.min) || !Array.isArray(bounds.max)) {
      throw new Error('Bounds must be arrays');
    }
    
    if (bounds.min.length !== bounds.max.length) {
      throw new Error('Bounds min and max arrays must have the same length');
    }
    
    this.paramDimension = bounds.min.length;
    
    // Set default options
    const isBrowser = typeof window !== 'undefined';
    const defaultWorkers = isBrowser && navigator.hardwareConcurrency ? 
      Math.max(1, Math.min(navigator.hardwareConcurrency - 1, 4)) : 2;
    
    this.options = {
      maxIterations: options.maxIterations || 100,
      populationSize: options.populationSize || 50,
      mutationRate: options.mutationRate || 0.1,
      crossoverRate: options.crossoverRate || 0.7,
      convergenceThreshold: options.convergenceThreshold || 1e-6,
      numWorkers: options.numWorkers || defaultWorkers,
      useWorkers: options.useWorkers !== false,
      enableCache: options.enableCache !== false,
      maxCacheSize: options.maxCacheSize || 10000,
      progressInterval: options.progressInterval || 100,
      algorithmType: options.algorithmType || 'hybrid',
    };
    
    // Initialize worker manager if needed
    if (isBrowser && this.options.useWorkers) {
      try {
        this.workerManager = new WorkerManager({
          maxWorkers: this.options.numWorkers,
          taskTimeout: 30000,
        });
        
        logger.debug('Initialized WebWorker manager for SPO optimizer', {
          workers: this.options.numWorkers,
          algorithm: this.options.algorithmType,
        });
      } catch (error) {
        logger.warn('Failed to initialize WebWorker manager, falling back to main thread', error);
        this.options.useWorkers = false;
      }
    } else {
      this.options.useWorkers = false;
    }
  }
  
  /**
   * Run optimization with progress tracking
   * 
   * @param progressCallback Optional callback for progress updates
   * @returns Promise resolving to optimization result
   */
  public async optimize(progressCallback?: ProgressCallback): Promise<OptimizationResult> {
    if (this.isRunning) {
      throw new Error('Optimization is already running');
    }
    
    this.isRunning = true;
    this.isCancelled = false;
    this.iterationCount = 0;
    this.startTime = performance.now();
    this.progressCallback = progressCallback;
    
    try {
      // Initialize population
      this.currentPopulation = await this.initializePopulation();
      
      // Set up progress reporting if callback provided
      if (this.progressCallback) {
        this.setupProgressReporting();
      }
      
      // Main optimization loop
      let converged = false;
      let prevBestValue = Infinity;
      
      while (
        this.iterationCount < this.options.maxIterations && 
        !this.isCancelled && 
        !converged
      ) {
        // Increment iteration counter
        this.iterationCount++;
        
        // Run one iteration based on selected algorithm
        await this.runIteration();
        
        // Check for convergence
        if (this.bestSolution) {
          const improvement = Math.abs(prevBestValue - this.bestSolution.value);
          converged = improvement < this.options.convergenceThreshold;
          prevBestValue = this.bestSolution.value;
        }
      }
      
      // Prepare result
      let terminationReason: string | undefined;
      if (this.iterationCount >= this.options.maxIterations) {
        terminationReason = 'Maximum iterations reached';
      } else if (this.isCancelled) {
        terminationReason = 'Optimization cancelled';
      } else if (converged) {
        terminationReason = 'Converged within threshold';
      }
      
      const timeElapsed = performance.now() - this.startTime;
      
      const result: OptimizationResult = {
        bestSolution: this.bestSolution || {
          parameters: Array(this.paramDimension).fill(0),
          value: Infinity,
          iteration: 0,
          feasible: false,
        },
        allSolutions: this.currentPopulation.slice(0, 10), // Return top 10 solutions
        iterations: this.iterationCount,
        timeElapsed,
        terminated: this.isCancelled,
        terminationReason,
      };
      
      return result;
    } finally {
      // Clean up
      this.isRunning = false;
      if (this.progressTimer) {
        clearInterval(this.progressTimer);
      }
    }
  }
  
  /**
   * Cancel ongoing optimization
   */
  public cancel(): void {
    if (this.isRunning) {
      this.isCancelled = true;
      logger.debug('Optimization cancelled');
    }
  }
  
  /**
   * Clean up resources, should be called when optimizer is no longer needed
   */
  public dispose(): void {
    this.cancel();
    if (this.workerManager) {
      this.workerManager.terminate();
      this.workerManager = undefined;
    }
    this.cache.clear();
  }
  
  /**
   * Get optimizer status
   */
  public getStatus(): {
    isRunning: boolean;
    iteration: number;
    bestSolution: Solution | null;
    timeElapsed: number;
    workerStatus?: {
      activeWorkers: number;
      idleWorkers: number;
      queuedTasks: number;
    };
  } {
    const timeElapsed = this.isRunning ? performance.now() - this.startTime : 0;
    
    return {
      isRunning: this.isRunning,
      iteration: this.iterationCount,
      bestSolution: this.bestSolution,
      timeElapsed,
      workerStatus: this.workerManager ? {
        ...this.workerManager.getStatus(),
      } : undefined,
    };
  }
  
  /**
   * Initialize population with random solutions
   */
  private async initializePopulation(): Promise<Solution[]> {
    const population: Solution[] = [];
    const tasks: Promise<Solution>[] = [];
    
    // Create initial population with random solutions
    for (let i = 0; i < this.options.populationSize; i++) {
      tasks.push(this.createRandomSolution());
    }
    
    // Wait for all solutions to be evaluated
    const solutions = await Promise.all(tasks);
    population.push(...solutions);
    
    // Sort by objective value (ascending for minimization)
    population.sort((a, b) => a.value - b.value);
    
    // Update best solution
    if (population.length > 0) {
      this.bestSolution = population[0];
    }
    
    return population;
  }
  
  /**
   * Create a random solution within bounds
   */
  private async createRandomSolution(): Promise<Solution> {
    // Generate random parameters within bounds
    const parameters: number[] = [];
    for (let i = 0; i < this.paramDimension; i++) {
      const min = this.bounds.min[i];
      const max = this.bounds.max[i];
      parameters.push(min + Math.random() * (max - min));
    }
    
    // Evaluate solution
    const value = await this.evaluateObjective(parameters);
    const feasible = await this.checkConstraints(parameters);
    
    return {
      parameters,
      value,
      iteration: this.iterationCount,
      feasible,
    };
  }
  
  /**
   * Run a single iteration of the optimization algorithm
   */
  private async runIteration(): Promise<void> {
    switch (this.options.algorithmType) {
      case 'genetic':
        await this.runGeneticIteration();
        break;
      case 'particle-swarm':
        await this.runParticleSwarmIteration();
        break;
      case 'hybrid':
      default:
        // Run a genetic iteration on even iterations, particle swarm on odd
        if (this.iterationCount % 2 === 0) {
          await this.runGeneticIteration();
        } else {
          await this.runParticleSwarmIteration();
        }
        break;
    }
    
    // Sort population by objective value (ascending for minimization)
    this.currentPopulation.sort((a, b) => a.value - b.value);
    
    // Update best solution
    if (this.currentPopulation.length > 0) {
      const newBest = this.currentPopulation[0];
      if (!this.bestSolution || newBest.value < this.bestSolution.value) {
        this.bestSolution = newBest;
      }
    }
  }
  
  /**
   * Run a genetic algorithm iteration
   */
  private async runGeneticIteration(): Promise<void> {
    // Selection: Tournament selection
    const parents = this.selectParents();
    
    // Create new population through crossover and mutation
    const offspring: Solution[] = [];
    const tasks: Promise<Solution>[] = [];
    
    for (let i = 0; i < this.options.populationSize; i += 2) {
      const parent1 = parents[i % parents.length];
      const parent2 = parents[(i + 1) % parents.length];
      
      // Crossover
      if (Math.random() < this.options.crossoverRate) {
        const [child1, child2] = this.crossover(parent1.parameters, parent2.parameters);
        
        // Mutation
        this.mutate(child1);
        this.mutate(child2);
        
        // Repair bounds if needed
        this.repairBounds(child1);
        this.repairBounds(child2);
        
        // Evaluate new solutions
        tasks.push(this.evaluateSolution(child1));
        tasks.push(this.evaluateSolution(child2));
      } else {
        // No crossover, just copy parents with possible mutation
        const child1 = [...parent1.parameters];
        const child2 = [...parent2.parameters];
        
        this.mutate(child1);
        this.mutate(child2);
        
        this.repairBounds(child1);
        this.repairBounds(child2);
        
        tasks.push(this.evaluateSolution(child1));
        tasks.push(this.evaluateSolution(child2));
      }
    }
    
    // Wait for all evaluations to complete
    offspring.push(...await Promise.all(tasks));
    
    // Elitism: Keep the best solution from previous generation
    const eliteCount = Math.max(1, Math.floor(this.options.populationSize * 0.1));
    const elites = this.currentPopulation.slice(0, eliteCount);
    
    // New population is combination of offspring and elites
    this.currentPopulation = [...offspring, ...elites];
    this.currentPopulation.sort((a, b) => a.value - b.value);
    this.currentPopulation = this.currentPopulation.slice(0, this.options.populationSize);
  }
  
  /**
   * Run a particle swarm optimization iteration
   */
  private async runParticleSwarmIteration(): Promise<void> {
    if (!this.bestSolution) {
      return;
    }
    
    // PSO parameters
    const inertia = 0.7;
    const cognitive = 1.5;
    const social = 1.5;
    
    // Initialize velocities if not already done
    if (!this.currentPopulation[0].hasOwnProperty('velocity')) {
      for (const particle of this.currentPopulation) {
        (particle as any).velocity = Array(this.paramDimension).fill(0);
        (particle as any).personalBest = {
          parameters: [...particle.parameters],
          value: particle.value,
        };
      }
    }
    
    const newPopulation: Solution[] = [];
    const tasks: Promise<Solution>[] = [];
    
    // Update each particle
    for (const particle of this.currentPopulation) {
      const velocity = (particle as any).velocity;
      const personalBest = (particle as any).personalBest;
      const newParameters: number[] = [];
      const newVelocity: number[] = [];
      
      // Update velocity and position for each dimension
      for (let i = 0; i < this.paramDimension; i++) {
        // Random coefficients
        const r1 = Math.random();
        const r2 = Math.random();
        
        // Update velocity: inertia + cognitive component + social component
        newVelocity[i] = 
          inertia * velocity[i] +
          cognitive * r1 * (personalBest.parameters[i] - particle.parameters[i]) +
          social * r2 * (this.bestSolution.parameters[i] - particle.parameters[i]);
        
        // Update position
        newParameters[i] = particle.parameters[i] + newVelocity[i];
      }
      
      // Repair bounds
      this.repairBounds(newParameters);
      
      // Evaluate new solution
      const evaluationPromise = this.evaluateSolution(newParameters).then(solution => {
        // Update personal best if new solution is better
        if (solution.value < personalBest.value) {
          (solution as any).personalBest = {
            parameters: [...solution.parameters],
            value: solution.value,
          };
        } else {
          (solution as any).personalBest = personalBest;
        }
        
        // Store velocity
        (solution as any).velocity = newVelocity;
        
        return solution;
      });
      
      tasks.push(evaluationPromise);
    }
    
    // Wait for all evaluations to complete
    newPopulation.push(...await Promise.all(tasks));
    
    // Replace population
    this.currentPopulation = newPopulation;
  }
  
  /**
   * Select parents using tournament selection
   */
  private selectParents(): Solution[] {
    const tournamentSize = Math.max(2, Math.floor(this.options.populationSize * 0.2));
    const parents: Solution[] = [];
    
    // Select parents through tournaments
    for (let i = 0; i < this.options.populationSize; i++) {
      // Randomly select tournament participants
      const tournamentIndices: number[] = [];
      while (tournamentIndices.length < tournamentSize) {
        const idx = Math.floor(Math.random() * this.currentPopulation.length);
        if (!tournamentIndices.includes(idx)) {
          tournamentIndices.push(idx);
        }
      }
      
      // Find the best solution in the tournament
      let bestIdx = tournamentIndices[0];
      let bestValue = this.currentPopulation[bestIdx].value;
      
      for (let j = 1; j < tournamentIndices.length; j++) {
        const idx = tournamentIndices[j];
        if (this.currentPopulation[idx].value < bestValue) {
          bestIdx = idx;
          bestValue = this.currentPopulation[idx].value;
        }
      }
      
      // Add winner to parents
      parents.push(this.currentPopulation[bestIdx]);
    }
    
    return parents;
  }
  
  /**
   * Perform crossover between two parent solutions
   */
  private crossover(parent1: number[], parent2: number[]): [number[], number[]] {
    // Simulated Binary Crossover (SBX)
    const distributionIndex = 15; // Distribution index (higher -> closer to parents)
    const child1: number[] = [];
    const child2: number[] = [];
    
    for (let i = 0; i < this.paramDimension; i++) {
      // Check if variables are different
      if (Math.abs(parent1[i] - parent2[i]) > 1e-10) {
        // Ensure parent1 has smaller value than parent2
        let y1 = Math.min(parent1[i], parent2[i]);
        let y2 = Math.max(parent1[i], parent2[i]);
        
        // Calculate bounds for this dimension
        const lowerBound = this.bounds.min[i];
        const upperBound = this.bounds.max[i];
        
        // Random number
        const rand = Math.random();
        
        // Calculate beta
        let beta = 1.0;
        if (rand <= 0.5) {
          beta = Math.pow(2.0 * rand, 1.0 / (distributionIndex + 1.0));
        } else {
          beta = Math.pow(1.0 / (2.0 * (1.0 - rand)), 1.0 / (distributionIndex + 1.0));
        }
        
        // Create children
        child1.push(0.5 * ((1 + beta) * y1 + (1 - beta) * y2));
        child2.push(0.5 * ((1 - beta) * y1 + (1 + beta) * y2));
        
        // Ensure within bounds
        child1[i] = Math.max(lowerBound, Math.min(upperBound, child1[i]));
        child2[i] = Math.max(lowerBound, Math.min(upperBound, child2[i]));
      } else {
        // If parents are identical, copy values
        child1.push(parent1[i]);
        child2.push(parent2[i]);
      }
    }
    
    return [child1, child2];
  }
  
  /**
   * Perform mutation on a solution
   */
  private mutate(solution: number[]): void {
    for (let i = 0; i < this.paramDimension; i++) {
      // Polynomial mutation with probability based on mutation rate
      if (Math.random() < this.options.mutationRate) {
        const distributionIndex = 20; // Distribution index (higher -> closer to original)
        const delta = Math.min(solution[i] - this.bounds.min[i], this.bounds.max[i] - solution[i]);
        
        // Skip if delta is very small
        if (delta < 1e-10) continue;
        
        // Random number
        const rand = Math.random();
        
        // Calculate mutation
        let deltaQ: number;
        if (rand < 0.5) {
          deltaQ = Math.pow(2.0 * rand, 1.0 / (distributionIndex + 1.0)) - 1.0;
        } else {
          deltaQ = 1.0 - Math.pow(2.0 * (1.0 - rand), 1.0 / (distributionIndex + 1.0));
        }
        
        // Apply mutation
        solution[i] += deltaQ * delta;
      }
    }
  }
  
  /**
   * Repair solution to ensure it's within bounds
   */
  private repairBounds(solution: number[]): void {
    for (let i = 0; i < this.paramDimension; i++) {
      solution[i] = Math.max(this.bounds.min[i], Math.min(this.bounds.max[i], solution[i]));
    }
  }
  
  /**
   * Evaluate a solution (parameters)
   */
  private async evaluateSolution(parameters: number[]): Promise<Solution> {
    const value = await this.evaluateObjective(parameters);
    const feasible = await this.checkConstraints(parameters);
    
    return {
      parameters: [...parameters],
      value,
      iteration: this.iterationCount,
      feasible,
    };
  }
  
  /**
   * Evaluate objective function with optional caching
   */
  private async evaluateObjective(parameters: number[]): Promise<number> {
    // Check cache first if enabled
    if (this.options.enableCache) {
      const key = JSON.stringify(parameters);
      const cached = this.cache.get(key);
      
      if (cached) {
        return cached.value;
      }
    }
    
    let value: number;
    
    // Evaluate using WebWorker if available, otherwise direct call
    if (this.workerManager && this.options.useWorkers) {
      value = await this.evaluateInWorker(parameters);
    } else {
      value = await this.objectiveFunction(parameters);
    }
    
    // Store in cache if enabled
    if (this.options.enableCache) {
      const key = JSON.stringify(parameters);
      
      // Manage cache size
      if (this.cache.size >= this.options.maxCacheSize) {
        // Simple strategy: remove oldest entry
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }
      
      this.cache.set(key, {
        parameters: key,
        value,
        timestamp: Date.now(),
      });
    }
    
    return value;
  }
  
  /**
   * Evaluate objective function in a worker
   */
  private async evaluateInWorker(parameters: number[]): Promise<number> {
    if (!this.workerManager) {
      throw new Error('Worker manager not available');
    }
    
    // Create task for worker
    const task = {
      id: uuidv4(),
      type: WorkerTaskType.COMPLEX_CALCULATION,
      priority: TaskPriority.NORMAL,
      input: {
        calculationType: 'spo-objective',
        parameters,
        functionCode: this.objectiveFunctionToString(),
      },
    };
    
    try {
      const result = await this.workerManager.executeTask(task);
      return result.value as number;
    } catch (error) {
      logger.error('Error evaluating objective in worker', error);
      // Fallback to direct evaluation
      return await this.objectiveFunction(parameters);
    }
  }
  
  /**
   * Check if solution satisfies all constraints
   */
  private async checkConstraints(parameters: number[]): Promise<boolean> {
    if (this.constraints.length === 0) {
      return true;
    }
    
    for (const constraint of this.constraints) {
      const satisfied = await constraint(parameters);
      if (!satisfied) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Convert objective function to string for worker
   */
  private objectiveFunctionToString(): string {
    // Try to convert the function to string
    const functionStr = this.objectiveFunction.toString();
    
    // Simple check to filter out non-serializable functions
    if (functionStr.includes('[native code]')) {
      throw new Error('Cannot serialize native function for worker');
    }
    
    // Ensure we have a valid string
    if (!functionStr || typeof functionStr !== 'string') {
      throw new Error('Failed to convert objective function to string');
    }
    
    return functionStr;
  }
  
  /**
   * Setup progress reporting
   */
  private setupProgressReporting(): void {
    if (this.progressTimer !== undefined) {
      clearInterval(this.progressTimer);
    }
    
    const intervalMs = this.options.progressInterval || 100;
    
    this.progressTimer = window.setInterval(() => {
      if (!this.isRunning || !this.progressCallback || !this.bestSolution) {
        return;
      }
      
      const timeElapsed = performance.now() - this.startTime;
      const timePerIteration = timeElapsed / Math.max(1, this.iterationCount);
      const remainingIterations = this.options.maxIterations - this.iterationCount;
      const estimatedTimeRemaining = timePerIteration * remainingIterations;
      
      const progressEvent: OptimizationProgressEvent = {
        iteration: this.iterationCount,
        bestSolution: this.bestSolution,
        currentPopulation: this.currentPopulation.slice(0, 5), // Top 5 solutions
        timeElapsed,
        estimatedTimeRemaining,
      };
      
      this.progressCallback(progressEvent);
    }, intervalMs) as unknown as number;
  }
}

export default BrowserSPOOptimizer; 