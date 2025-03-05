import { logger } from '../utils/logger';

/**
 * Task types that can be executed in a web worker
 */
export enum WorkerTaskType {
  TEXT_PROCESSING = 'text_processing',
  VECTOR_COMPUTATION = 'vector_computation',
  MODEL_INFERENCE = 'model_inference',
  DATA_TRANSFORMATION = 'data_transformation',
  BACKGROUND_FETCH = 'background_fetch',
  COMPLEX_CALCULATION = 'complex_calculation',
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Interface for task input data
 */
export interface TaskInput {
  [key: string]: unknown;
}

/**
 * Interface for task result data
 */
export interface TaskResult {
  [key: string]: unknown;
}

/**
 * Interface for worker task
 */
export interface WorkerTask {
  id: string;
  type: WorkerTaskType;
  priority: TaskPriority;
  input: TaskInput;
  transferList?: Transferable[];
}

/**
 * Interface for worker task response
 */
export interface WorkerTaskResponse {
  taskId: string;
  success: boolean;
  result?: TaskResult;
  error?: string;
  processingTime?: number;
}

/**
 * Options for worker manager
 */
export interface WorkerManagerOptions {
  /**
   * Maximum number of workers to create
   * Default: navigator.hardwareConcurrency || 4
   */
  maxWorkers?: number;
  
  /**
   * Custom worker script URL
   * If not provided, an inline worker will be created
   */
  workerScriptUrl?: string;
  
  /**
   * Timeout for worker tasks in milliseconds
   * Default: 30000 (30 seconds)
   */
  taskTimeout?: number;
  
  /**
   * Whether to automatically terminate idle workers
   * Default: true
   */
  terminateIdleWorkers?: boolean;
  
  /**
   * Time in milliseconds after which idle workers are terminated
   * Default: 60000 (1 minute)
   */
  idleTimeout?: number;
}

/**
 * Worker instance information
 */
interface WorkerInstance {
  worker: Worker;
  taskQueue: WorkerTask[];
  currentTask: WorkerTask | null;
  busy: boolean;
  idleSince: number | null;
}

/**
 * Task with additional metadata for tracking
 */
interface TaskWithMetadata extends WorkerTask {
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  promise: {
    resolve: (result: TaskResult) => void;
    reject: (error: Error) => void;
  };
  timeoutId?: number;
}

/**
 * Web Worker Manager for browser environments
 * 
 * Features:
 * - Dynamic worker pool management
 * - Task queue with priority support
 * - Automatic worker termination when idle
 * - Task timeouts to prevent hanging workers
 * - Fallback execution in main thread when workers are unavailable
 */
export class WorkerManager {
  private workers: WorkerInstance[] = [];
  private taskQueue: TaskWithMetadata[] = [];
  private options: Required<WorkerManagerOptions>;
  private workerScript: string;
  private isBrowser: boolean;

  /**
   * Create a new WorkerManager instance
   * @param options Configuration options for worker manager
   */
  constructor(options: WorkerManagerOptions = {}) {
    // Check if running in browser environment
    this.isBrowser = typeof window !== 'undefined' && typeof Worker !== 'undefined';

    // Set default options
    this.options = {
      maxWorkers: options.maxWorkers || (this.isBrowser && navigator.hardwareConcurrency) || 4,
      workerScriptUrl: options.workerScriptUrl || '',
      taskTimeout: options.taskTimeout || 30000,
      terminateIdleWorkers: options.terminateIdleWorkers !== false,
      idleTimeout: options.idleTimeout || 60000,
    };

    // Create inline worker script if URL not provided
    this.workerScript = this.options.workerScriptUrl || this.generateInlineWorkerScript();

    // Log configuration
    logger.debug('WorkerManager initialized', {
      maxWorkers: this.options.maxWorkers,
      isBrowser: this.isBrowser,
      userAgent: this.isBrowser ? navigator.userAgent : 'Node.js',
    });
  }

  /**
   * Execute a task in a worker
   * @param task Task to execute
   * @returns Promise resolving to task result
   */
  public async executeTask(task: WorkerTask): Promise<TaskResult> {
    if (!this.isBrowser) {
      logger.warn('WorkerManager: Not running in browser environment, executing in main thread');
      return this.executeInMainThread(task);
    }

    return new Promise<TaskResult>((resolve, reject) => {
      const taskWithMetadata: TaskWithMetadata = {
        ...task,
        createdAt: Date.now(),
        promise: { resolve, reject },
      };

      // Set task timeout
      if (this.options.taskTimeout > 0) {
        taskWithMetadata.timeoutId = window.setTimeout(() => {
          this.handleTaskTimeout(taskWithMetadata);
        }, this.options.taskTimeout);
      }

      // Add task to queue and process
      this.taskQueue.push(taskWithMetadata);
      this.sortTaskQueue();
      this.processQueue();
    });
  }

  /**
   * Terminate all workers and clear task queue
   */
  public terminate(): void {
    // Terminate all workers
    for (const workerInstance of this.workers) {
      workerInstance.worker.terminate();
    }

    // Clear workers array
    this.workers = [];

    // Reject all pending tasks
    for (const task of this.taskQueue) {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      task.promise.reject(new Error('WorkerManager terminated'));
    }

    // Clear task queue
    this.taskQueue = [];

    logger.debug('WorkerManager terminated');
  }

  /**
   * Get current status of the worker manager
   */
  public getStatus(): {
    activeWorkers: number;
    idleWorkers: number;
    queuedTasks: number;
    executingTasks: number;
  } {
    const activeWorkers = this.workers.filter(w => w.busy).length;
    const idleWorkers = this.workers.length - activeWorkers;
    const queuedTasks = this.taskQueue.length;
    const executingTasks = activeWorkers;

    return {
      activeWorkers,
      idleWorkers,
      queuedTasks,
      executingTasks,
    };
  }

  /**
   * Process task queue by assigning tasks to available workers
   * or creating new workers if needed and possible
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) {
      return;
    }

    // Check for idle workers
    const idleWorker = this.workers.find(worker => !worker.busy);
    if (idleWorker) {
      const task = this.taskQueue.shift();
      if (task) {
        this.assignTaskToWorker(task, idleWorker);
      }
      return;
    }

    // Create new worker if below max limit
    if (this.workers.length < this.options.maxWorkers) {
      try {
        const newWorker = this.createWorker();
        const task = this.taskQueue.shift();
        if (task) {
          this.assignTaskToWorker(task, newWorker);
        }
      } catch (error) {
        logger.error('Failed to create web worker', error);
        // If we can't create a worker, execute the task in main thread
        const task = this.taskQueue.shift();
        if (task) {
          this.executeTaskInMainThread(task);
        }
      }
    }
  }

  /**
   * Create a new web worker instance
   */
  private createWorker(): WorkerInstance {
    // Create worker from script
    let worker: Worker;
    try {
      if (this.options.workerScriptUrl) {
        worker = new Worker(this.options.workerScriptUrl);
      } else {
        const blob = new Blob([this.workerScript], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        worker = new Worker(url);
      }
    } catch (error) {
      logger.error('Error creating worker', error);
      throw new Error('Failed to create web worker');
    }

    // Set up message handler
    worker.onmessage = (event: MessageEvent<WorkerTaskResponse>) => {
      const response = event.data;
      this.handleWorkerResponse(response);
    };

    // Set up error handler
    worker.onerror = (event: ErrorEvent) => {
      logger.error('Worker error', event.message);
      
      // Find which worker instance had the error
      const workerInstance = this.workers.find(w => w.worker === worker);
      if (workerInstance && workerInstance.currentTask) {
        const { currentTask } = workerInstance;
        // Find the task in our tracking system
        const task = this.findTaskById(currentTask.id);
        if (task) {
          if (task.timeoutId) {
            clearTimeout(task.timeoutId);
          }
          task.promise.reject(new Error(`Worker error: ${event.message}`));
        }

        // Mark worker as idle
        workerInstance.busy = false;
        workerInstance.currentTask = null;
        workerInstance.idleSince = Date.now();

        // Process next task
        this.processQueue();
      }
    };

    // Create worker instance
    const workerInstance: WorkerInstance = {
      worker,
      taskQueue: [],
      currentTask: null,
      busy: false,
      idleSince: Date.now(),
    };

    // Add to workers array
    this.workers.push(workerInstance);

    logger.debug(`Created new worker (total: ${this.workers.length})`);

    return workerInstance;
  }

  /**
   * Assign task to worker instance
   */
  private assignTaskToWorker(task: TaskWithMetadata, workerInstance: WorkerInstance): void {
    // Mark task as started
    task.startedAt = Date.now();

    // Mark worker as busy
    workerInstance.busy = true;
    workerInstance.currentTask = task;
    workerInstance.idleSince = null;

    // Send task to worker
    try {
      workerInstance.worker.postMessage(
        {
          taskId: task.id,
          type: task.type,
          input: task.input,
        },
        task.transferList || []
      );
    } catch (error) {
      logger.error('Error posting message to worker', error);
      
      // If posting fails, execute in main thread
      this.executeTaskInMainThread(task);
      
      // Mark worker as idle
      workerInstance.busy = false;
      workerInstance.currentTask = null;
      workerInstance.idleSince = Date.now();
      
      // Process next task
      this.processQueue();
    }
  }

  /**
   * Handle response from worker
   */
  private handleWorkerResponse(response: WorkerTaskResponse): void {
    // Find worker that sent the response
    const workerInstance = this.workers.find(
      w => w.currentTask && w.currentTask.id === response.taskId
    );

    if (!workerInstance) {
      logger.warn('Received response for unknown task', response);
      return;
    }

    // Find the task in our tracking system
    const task = this.findTaskById(response.taskId);
    if (!task) {
      logger.warn('Task not found for response', response);
      return;
    }

    // Clear timeout
    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
    }

    // Mark task as completed
    task.completedAt = Date.now();

    // Handle task result
    if (response.success) {
      task.promise.resolve(response.result || {});
    } else {
      task.promise.reject(new Error(response.error || 'Unknown worker error'));
    }

    // Mark worker as idle
    workerInstance.busy = false;
    workerInstance.currentTask = null;
    workerInstance.idleSince = Date.now();

    // Check if worker should be terminated due to idle timeout
    if (this.options.terminateIdleWorkers) {
      this.scheduleIdleCheck();
    }

    // Process next task in queue
    this.processQueue();
  }

  /**
   * Handle task timeout
   */
  private handleTaskTimeout(task: TaskWithMetadata): void {
    // Find worker executing this task
    const workerInstance = this.workers.find(
      w => w.currentTask && w.currentTask.id === task.id
    );

    if (workerInstance) {
      // Terminate the worker to stop execution
      workerInstance.worker.terminate();
      
      // Remove from workers array
      const index = this.workers.indexOf(workerInstance);
      if (index !== -1) {
        this.workers.splice(index, 1);
      }
      
      // Create a replacement worker if needed
      if (this.taskQueue.length > 0) {
        try {
          this.createWorker();
        } catch (error) {
          logger.error('Failed to create replacement worker', error);
        }
      }
    }

    // Remove from task queue if still there
    const queueIndex = this.taskQueue.indexOf(task);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
    }

    // Reject the task promise
    task.promise.reject(new Error(`Task timeout after ${this.options.taskTimeout}ms`));

    // Process queue in case we need to reassign tasks
    this.processQueue();
  }

  /**
   * Execute task in main thread as fallback
   */
  private executeTaskInMainThread(task: TaskWithMetadata): void {
    logger.warn('Executing task in main thread as fallback', { taskId: task.id, type: task.type });
    
    // Clear timeout since we're handling it differently
    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
    }

    // Execute in main thread and handle result
    this.executeInMainThread(task)
      .then(result => {
        task.promise.resolve(result);
      })
      .catch(error => {
        task.promise.reject(error);
      });
  }

  /**
   * Execute a task in the main thread (fallback implementation)
   */
  private async executeInMainThread(task: WorkerTask): Promise<TaskResult> {
    const startTime = Date.now();
    logger.debug(`Executing task ${task.id} in main thread`, { type: task.type });

    try {
      let result: TaskResult;

      // Implement fallback logic for different task types
      switch (task.type) {
        case WorkerTaskType.TEXT_PROCESSING:
          result = this.processTextInMainThread(task.input);
          break;
        case WorkerTaskType.VECTOR_COMPUTATION:
          result = this.computeVectorsInMainThread(task.input);
          break;
        case WorkerTaskType.DATA_TRANSFORMATION:
          result = this.transformDataInMainThread(task.input);
          break;
        case WorkerTaskType.BACKGROUND_FETCH:
          result = await this.fetchInMainThread(task.input);
          break;
        case WorkerTaskType.COMPLEX_CALCULATION:
          result = this.performCalculationInMainThread(task.input);
          break;
        case WorkerTaskType.MODEL_INFERENCE:
          throw new Error('Model inference cannot be executed in main thread');
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }

      const endTime = Date.now();
      logger.debug(`Task ${task.id} completed in main thread`, {
        type: task.type,
        executionTime: endTime - startTime,
      });

      return result;
    } catch (error) {
      logger.error(`Error executing task ${task.id} in main thread`, error);
      throw error;
    }
  }

  /**
   * Process text in main thread (fallback implementation)
   */
  private processTextInMainThread(input: TaskInput): TaskResult {
    const text = input.text as string;
    if (!text) {
      throw new Error('No text provided for text processing');
    }

    // Basic text processing operations
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const charCount = text.length;
    const lineCount = text.split('\n').length;
    const uppercase = text.toUpperCase();
    const lowercase = text.toLowerCase();

    return {
      wordCount,
      charCount,
      lineCount,
      uppercase,
      lowercase,
    };
  }

  /**
   * Compute vectors in main thread (fallback implementation)
   */
  private computeVectorsInMainThread(input: TaskInput): TaskResult {
    // This is a simplified implementation
    // In a real application, you'd have more sophisticated vector operations
    const vector1 = input.vector1 as number[];
    const vector2 = input.vector2 as number[];

    if (!Array.isArray(vector1) || !Array.isArray(vector2)) {
      throw new Error('Invalid vectors provided');
    }

    // Dot product
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);

    // Euclidean distance
    const euclideanDistance = Math.sqrt(
      vector1.reduce((sum, val, i) => sum + Math.pow(val - vector2[i], 2), 0)
    );

    // Cosine similarity
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);

    return {
      dotProduct,
      euclideanDistance,
      cosineSimilarity,
    };
  }

  /**
   * Transform data in main thread (fallback implementation)
   */
  private transformDataInMainThread(input: TaskInput): TaskResult {
    const data = input.data;
    const operation = input.operation as string;

    if (!data || !operation) {
      throw new Error('Invalid data or operation for data transformation');
    }

    // Perform basic transformations based on operation type
    switch (operation) {
      case 'filter':
        const filterFn = new Function('item', input.filterCode as string) as (item: any) => boolean;
        return {
          result: Array.isArray(data) ? data.filter(item => filterFn(item)) : data,
        };
      case 'map':
        const mapFn = new Function('item', input.mapCode as string) as (item: any) => any;
        return {
          result: Array.isArray(data) ? data.map(item => mapFn(item)) : data,
        };
      case 'sort':
        const sortFn = new Function('a', 'b', input.sortCode as string) as (a: any, b: any) => number;
        return {
          result: Array.isArray(data) ? [...data].sort(sortFn) : data,
        };
      case 'json':
        return {
          result: typeof data === 'string' ? JSON.parse(data as string) : JSON.stringify(data),
        };
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Perform fetch in main thread (fallback implementation)
   */
  private async fetchInMainThread(input: TaskInput): Promise<TaskResult> {
    const url = input.url as string;
    const options = input.options as RequestInit | undefined;

    if (!url) {
      throw new Error('No URL provided for fetch operation');
    }

    try {
      const response = await fetch(url, options);
      
      // Handle different response types
      let data: unknown;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType.includes('text/')) {
        data = await response.text();
      } else {
        data = await response.arrayBuffer();
      }

      // Convert headers to a plain object
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        data,
        ok: response.ok,
      };
    } catch (error) {
      throw new Error(`Fetch error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform calculation in main thread (fallback implementation)
   */
  private performCalculationInMainThread(input: TaskInput): TaskResult {
    const type = input.calculationType as string;
    
    if (!type) {
      throw new Error('No calculation type specified');
    }

    switch (type) {
      case 'fibonacci': {
        const n = Number(input.n);
        if (isNaN(n) || n < 0) {
          throw new Error('Invalid input for Fibonacci calculation');
        }
        return { result: this.fibonacci(n) };
      }
      case 'prime': {
        const n = Number(input.n);
        if (isNaN(n) || n < 0) {
          throw new Error('Invalid input for prime calculation');
        }
        return { result: this.isPrime(n) };
      }
      case 'matrix': {
        const matrix1 = input.matrix1 as number[][];
        const matrix2 = input.matrix2 as number[][];
        if (!Array.isArray(matrix1) || !Array.isArray(matrix2)) {
          throw new Error('Invalid matrices provided');
        }
        return { result: this.multiplyMatrices(matrix1, matrix2) };
      }
      default:
        throw new Error(`Unknown calculation type: ${type}`);
    }
  }

  /**
   * Calculate Fibonacci number (helper method)
   */
  private fibonacci(n: number): number {
    if (n <= 1) return n;
    return this.fibonacci(n - 1) + this.fibonacci(n - 2);
  }

  /**
   * Check if number is prime (helper method)
   */
  private isPrime(n: number): boolean {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    let i = 5;
    while (i * i <= n) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
      i += 6;
    }
    return true;
  }

  /**
   * Multiply matrices (helper method)
   */
  private multiplyMatrices(matrix1: number[][], matrix2: number[][]): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < matrix1.length; i++) {
      result[i] = [];
      for (let j = 0; j < matrix2[0].length; j++) {
        result[i][j] = 0;
        for (let k = 0; k < matrix1[0].length; k++) {
          result[i][j] += matrix1[i][k] * matrix2[k][j];
        }
      }
    }
    return result;
  }

  /**
   * Schedule check for idle workers
   */
  private scheduleIdleCheck(): void {
    setTimeout(() => {
      this.checkIdleWorkers();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Check for and terminate idle workers
   */
  private checkIdleWorkers(): void {
    const now = Date.now();
    let terminatedCount = 0;

    // Keep at least one worker alive
    const minWorkersToKeep = 1;

    for (let i = this.workers.length - 1; i >= 0; i--) {
      const worker = this.workers[i];
      if (
        !worker.busy &&
        worker.idleSince &&
        now - worker.idleSince > this.options.idleTimeout &&
        this.workers.length > minWorkersToKeep
      ) {
        // Terminate worker
        worker.worker.terminate();
        this.workers.splice(i, 1);
        terminatedCount++;
      }
    }

    if (terminatedCount > 0) {
      logger.debug(`Terminated ${terminatedCount} idle workers`);
    }
  }

  /**
   * Sort task queue by priority
   */
  private sortTaskQueue(): void {
    this.taskQueue.sort((a, b) => {
      // Sort by priority (higher first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Then by creation time (older first)
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Find task by ID
   */
  private findTaskById(taskId: string): TaskWithMetadata | undefined {
    return this.taskQueue.find(task => task.id === taskId);
  }

  /**
   * Generate inline worker script
   */
  private generateInlineWorkerScript(): string {
    return `
    self.onmessage = function(event) {
      const { taskId, type, input } = event.data;
      const startTime = Date.now();
      
      try {
        let result;
        
        switch (type) {
          case 'text_processing':
            result = processText(input);
            break;
          case 'vector_computation':
            result = computeVectors(input);
            break;
          case 'data_transformation':
            result = transformData(input);
            break;
          case 'background_fetch':
            // Note: fetch will create a Promise, which we handle specially
            handleFetch(taskId, input, startTime);
            return; // Early return for async operations
          case 'complex_calculation':
            result = performCalculation(input);
            break;
          case 'model_inference':
            result = performInference(input);
            break;
          default:
            throw new Error('Unknown task type: ' + type);
        }
        
        const processingTime = Date.now() - startTime;
        
        self.postMessage({
          taskId,
          success: true,
          result,
          processingTime
        });
      } catch (error) {
        self.postMessage({
          taskId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          processingTime: Date.now() - startTime
        });
      }
    };
    
    // Implementation of text processing
    function processText(input) {
      const text = input.text;
      if (!text) {
        throw new Error('No text provided for text processing');
      }
      
      const wordCount = text.split(/\\s+/).filter(Boolean).length;
      const charCount = text.length;
      const lineCount = text.split('\\n').length;
      const uppercase = text.toUpperCase();
      const lowercase = text.toLowerCase();
      
      return {
        wordCount,
        charCount,
        lineCount,
        uppercase,
        lowercase
      };
    }
    
    // Implementation of vector computation
    function computeVectors(input) {
      const vector1 = input.vector1;
      const vector2 = input.vector2;
      
      if (!Array.isArray(vector1) || !Array.isArray(vector2)) {
        throw new Error('Invalid vectors provided');
      }
      
      // Dot product
      const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
      
      // Euclidean distance
      const euclideanDistance = Math.sqrt(
        vector1.reduce((sum, val, i) => sum + Math.pow(val - vector2[i], 2), 0)
      );
      
      // Cosine similarity
      const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
      const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
      const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
      
      return {
        dotProduct,
        euclideanDistance,
        cosineSimilarity
      };
    }
    
    // Implementation of data transformation
    function transformData(input) {
      const data = input.data;
      const operation = input.operation;
      
      if (!data || !operation) {
        throw new Error('Invalid data or operation for data transformation');
      }
      
      switch (operation) {
        case 'filter':
          const filterFn = new Function('item', input.filterCode);
          return {
            result: Array.isArray(data) ? data.filter(item => filterFn(item)) : data,
          };
        case 'map':
          const mapFn = new Function('item', input.mapCode);
          return {
            result: Array.isArray(data) ? data.map(item => mapFn(item)) : data,
          };
        case 'sort':
          const sortFn = new Function('a', 'b', input.sortCode);
          return {
            result: Array.isArray(data) ? [...data].sort(sortFn) : data,
          };
        case 'json':
          return {
            result: typeof data === 'string' ? JSON.parse(data) : JSON.stringify(data),
          };
        default:
          throw new Error('Unknown operation: ' + operation);
      }
    }
    
    // Handle fetch operations (async)
    function handleFetch(taskId, input, startTime) {
      const url = input.url;
      const options = input.options;
      
      if (!url) {
        self.postMessage({
          taskId,
          success: false,
          error: 'No URL provided for fetch operation',
          processingTime: Date.now() - startTime
        });
        return;
      }
      
      fetch(url, options)
        .then(response => {
          const contentType = response.headers.get('content-type') || '';
          
          if (contentType.includes('application/json')) {
            return response.json().then(data => ({
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              data,
              ok: response.ok
            }));
          } else if (contentType.includes('text/')) {
            return response.text().then(data => ({
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              data,
              ok: response.ok
            }));
          } else {
            return response.arrayBuffer().then(data => ({
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
              data,
              ok: response.ok
            }));
          }
        })
        .then(result => {
          self.postMessage({
            taskId,
            success: true,
            result,
            processingTime: Date.now() - startTime
          });
        })
        .catch(error => {
          self.postMessage({
            taskId,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            processingTime: Date.now() - startTime
          });
        });
    }
    
    // Perform calculation
    function performCalculation(input) {
      const type = input.calculationType;
      
      if (!type) {
        throw new Error('No calculation type specified');
      }
      
      switch (type) {
        case 'fibonacci': {
          const n = Number(input.n);
          if (isNaN(n) || n < 0) {
            throw new Error('Invalid input for Fibonacci calculation');
          }
          return { result: fibonacci(n) };
        }
        case 'prime': {
          const n = Number(input.n);
          if (isNaN(n) || n < 0) {
            throw new Error('Invalid input for prime calculation');
          }
          return { result: isPrime(n) };
        }
        case 'matrix': {
          const matrix1 = input.matrix1;
          const matrix2 = input.matrix2;
          if (!Array.isArray(matrix1) || !Array.isArray(matrix2)) {
            throw new Error('Invalid matrices provided');
          }
          return { result: multiplyMatrices(matrix1, matrix2) };
        }
        default:
          throw new Error('Unknown calculation type: ' + type);
      }
    }
    
    function fibonacci(n) {
      if (n <= 1) return n;
      
      let a = 0, b = 1;
      for (let i = 2; i <= n; i++) {
        const temp = a + b;
        a = b;
        b = temp;
      }
      return b;
    }
    
    function isPrime(n) {
      if (n <= 1) return false;
      if (n <= 3) return true;
      if (n % 2 === 0 || n % 3 === 0) return false;
      let i = 5;
      while (i * i <= n) {
        if (n % i === 0 || n % (i + 2) === 0) return false;
        i += 6;
      }
      return true;
    }
    
    function multiplyMatrices(matrix1, matrix2) {
      const result = [];
      for (let i = 0; i < matrix1.length; i++) {
        result[i] = [];
        for (let j = 0; j < matrix2[0].length; j++) {
          result[i][j] = 0;
          for (let k = 0; k < matrix1[0].length; k++) {
            result[i][j] += matrix1[i][k] * matrix2[k][j];
          }
        }
      }
      return result;
    }
    
    // Perform model inference
    function performInference(input) {
      throw new Error('Model inference is not implemented in the default worker');
    }
    `;
  }
}

export default WorkerManager; 