import type { NodeExecutor, WorkflowNode } from '../../types/workflow';

/**
 * 并行节点配置
 */
interface ParallelConfig {
  /** 最大并发数 */
  maxConcurrency?: number;
  /** 错误处理策略 */
  errorStrategy?: 'fail-fast' | 'continue' | 'ignore';
  /** 超时时间(ms) */
  timeout?: number;
}

/**
 * 并行节点执行器
 * 用于并行执行多个子节点
 */
export class ParallelNodeExecutor implements NodeExecutor {
  private status: string = 'pending';
  private result: any = null;

  /**
   * 执行并行节点
   * @param node 工作流节点
   * @param context 执行上下文
   */
  async execute(node: WorkflowNode, context: any): Promise<any[]> {
    try {
      this.status = 'running';
      
      // 获取并行配置
      const config = this.getParallelConfig(node);
      
      // 获取子节点执行器
      const childExecutors = this.getChildExecutors(node, context);
      if (childExecutors.length === 0) {
        throw new Error(`No child nodes found in parallel node: ${node.id}`);
      }

      // 执行子节点
      const results = await this.executeParallel(childExecutors, config);
      this.result = results;
      this.status = 'completed';
      
      return results;
    } catch (error) {
      this.status = 'failed';
      this.result = error;
      throw error;
    }
  }

  /**
   * 验证节点配置
   * @param node 工作流节点
   */
  validate(node: WorkflowNode): boolean {
    return (
      node.type === 'parallel' &&
      Array.isArray(node.childIds) &&
      node.childIds.length > 0
    );
  }

  /**
   * 获取节点状态
   */
  getStatus(): string {
    return this.status;
  }

  /**
   * 获取执行结果
   */
  getResult(): any {
    return this.result;
  }

  /**
   * 从节点配置中获取并行配置
   * @param node 工作流节点
   */
  private getParallelConfig(node: WorkflowNode): ParallelConfig {
    return {
      maxConcurrency: Infinity,
      errorStrategy: 'fail-fast',
      timeout: 0,
      ...(node.config?.parallel || {}),
    };
  }

  /**
   * 获取子节点执行器列表
   * @param node 工作流节点
   * @param context 执行上下文
   */
  private getChildExecutors(
    node: WorkflowNode,
    context: any
  ): Array<() => Promise<any>> {
    return node.childIds.map(childId => {
      const childNode = context.workflow.nodes.find(
        (n: WorkflowNode) => n.id === childId
      );
      if (!childNode) {
        throw new Error(`Child node not found: ${childId}`);
      }

      const executor = context.workflow.nodeExecutors.get(childNode.type);
      if (!executor) {
        throw new Error(`No executor found for node type: ${childNode.type}`);
      }

      return () => executor.execute(childNode, context);
    });
  }

  /**
   * 并行执行子节点
   * @param executors 执行器列表
   * @param config 并行配置
   */
  private async executeParallel(
    executors: Array<() => Promise<any>>,
    config: ParallelConfig
  ): Promise<any[]> {
    const results: any[] = [];
    const errors: Error[] = [];

    // 创建执行队列
    const queue = [...executors];
    const running = new Set<Promise<void>>();

    while (queue.length > 0 || running.size > 0) {
      // 检查是否可以启动新的执行器
      while (
        queue.length > 0 &&
        running.size < (config.maxConcurrency || Infinity)
      ) {
        const executor = queue.shift()!;
        const promise = (async () => {
          try {
            const result = await this.executeWithTimeout(
              executor(),
              config.timeout
            );
            results.push(result);
          } catch (error) {
            errors.push(error as Error);
            if (config.errorStrategy === 'fail-fast') {
              queue.length = 0; // 清空队列
              throw error;
            }
          }
        })();

        running.add(promise);
        // 执行完成后从运行集合中移除
        promise.finally(() => running.delete(promise));
      }

      // 等待任意一个执行器完成
      if (running.size > 0) {
        await Promise.race(running);
      }
    }

    // 处理错误
    if (errors.length > 0 && config.errorStrategy !== 'ignore') {
      throw new AggregateError(
        errors,
        `${errors.length} parallel executions failed`
      );
    }

    return results;
  }

  /**
   * 带超时的执行
   * @param promise Promise
   * @param timeout 超时时间
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout?: number
  ): Promise<T> {
    if (!timeout || timeout <= 0) {
      return promise;
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timed out after ${timeout}ms`));
      }, timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }
} 