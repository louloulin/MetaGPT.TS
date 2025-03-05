import type { NodeExecutor, WorkflowNode } from '../../types/workflow';

/**
 * 顺序节点配置
 */
interface SequenceConfig {
  /** 错误处理策略 */
  errorStrategy?: 'fail-fast' | 'continue' | 'ignore';
  /** 超时时间(ms) */
  timeout?: number;
  /** 是否传递上一个节点的结果到下一个节点 */
  passPreviousResult?: boolean;
}

/**
 * 顺序节点执行器
 * 用于按顺序执行多个子节点
 */
export class SequenceNodeExecutor implements NodeExecutor {
  private status: string = 'pending';
  private result: any = null;

  /**
   * 执行顺序节点
   * @param node 工作流节点
   * @param context 执行上下文
   */
  async execute(node: WorkflowNode, context: any): Promise<any[]> {
    try {
      this.status = 'running';
      
      // 获取顺序配置
      const config = this.getSequenceConfig(node);
      
      // 获取子节点执行器
      const childExecutors = this.getChildExecutors(node, context);
      if (childExecutors.length === 0) {
        throw new Error(`No child nodes found in sequence node: ${node.id}`);
      }

      // 执行子节点
      const results = await this.executeSequence(childExecutors, config, context);
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
      node.type === 'sequence' &&
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
   * 从节点配置中获取顺序配置
   * @param node 工作流节点
   */
  private getSequenceConfig(node: WorkflowNode): SequenceConfig {
    return {
      errorStrategy: 'fail-fast',
      timeout: 0,
      passPreviousResult: false,
      ...(node.config?.sequence || {}),
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
  ): Array<(ctx: any) => Promise<any>> {
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

      return (ctx: any) => executor.execute(childNode, ctx);
    });
  }

  /**
   * 顺序执行子节点
   * @param executors 执行器列表
   * @param config 顺序配置
   * @param baseContext 基础上下文
   */
  private async executeSequence(
    executors: Array<(ctx: any) => Promise<any>>,
    config: SequenceConfig,
    baseContext: any
  ): Promise<any[]> {
    const results: any[] = [];
    const errors: Error[] = [];
    let currentContext = { ...baseContext };

    for (const executor of executors) {
      try {
        // 执行当前节点
        const result = await this.executeWithTimeout(
          executor(currentContext),
          config.timeout
        );
        results.push(result);

        // 如果需要传递结果，更新上下文
        if (config.passPreviousResult) {
          currentContext = {
            ...currentContext,
            previousResult: result,
          };
        }
      } catch (error) {
        errors.push(error as Error);
        if (config.errorStrategy === 'fail-fast') {
          throw error;
        } else if (config.errorStrategy === 'continue') {
          results.push(null);
          continue;
        } else {
          // ignore error
          continue;
        }
      }
    }

    // 处理错误
    if (errors.length > 0 && config.errorStrategy !== 'ignore') {
      throw new AggregateError(
        errors,
        `${errors.length} sequence executions failed`
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