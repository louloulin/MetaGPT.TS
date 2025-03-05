import type { NodeExecutor, WorkflowNode } from '../../types/workflow';

/**
 * 条件节点配置
 */
interface ConditionConfig {
  /** 条件表达式 */
  expression: string;
  /** 条件参数 */
  params?: Record<string, any>;
  /** 条件处理函数 */
  handler?: (params: Record<string, any>) => boolean | Promise<boolean>;
}

/**
 * 条件节点执行器
 * 用于执行条件类型的工作流节点
 */
export class ConditionNodeExecutor implements NodeExecutor {
  private status: string = 'pending';
  private result: any = null;

  /**
   * 执行条件节点
   * @param node 工作流节点
   * @param context 执行上下文
   */
  async execute(node: WorkflowNode, context: any): Promise<boolean> {
    try {
      this.status = 'running';
      
      // 获取条件配置
      const config = this.getConditionConfig(node);
      if (!config) {
        throw new Error(`Condition config not found in node: ${node.id}`);
      }

      // 执行条件判断
      const result = await this.evaluateCondition(config, context);
      this.result = result;
      this.status = 'completed';
      
      return result;
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
    const config = this.getConditionConfig(node);
    return (
      node.type === 'condition' &&
      !!config &&
      (!!config.expression || !!config.handler)
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
   * 从节点配置中获取条件配置
   * @param node 工作流节点
   */
  private getConditionConfig(node: WorkflowNode): ConditionConfig | undefined {
    return node.config?.condition as ConditionConfig;
  }

  /**
   * 执行条件判断
   * @param config 条件配置
   * @param context 执行上下文
   */
  private async evaluateCondition(
    config: ConditionConfig,
    context: any
  ): Promise<boolean> {
    try {
      // 如果提供了处理函数，优先使用处理函数
      if (config.handler) {
        return await config.handler(config.params || {});
      }

      // 否则使用表达式求值
      const params = {
        ...config.params,
        context,
      };
      
      // 使用 Function 构造函数创建表达式求值函数
      const evaluator = new Function(
        ...Object.keys(params),
        `return ${config.expression};`
      );
      
      return evaluator(...Object.values(params));
    } catch (error) {
      throw new Error(`Failed to evaluate condition: ${error}`);
    }
  }
} 