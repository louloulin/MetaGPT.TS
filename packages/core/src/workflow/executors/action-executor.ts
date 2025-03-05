import type { NodeExecutor, WorkflowNode } from '../../types/workflow';
import type { Action, ActionOutput } from '../../types/action';

/**
 * 动作节点执行器
 * 用于执行动作类型的工作流节点
 */
export class ActionNodeExecutor implements NodeExecutor {
  private status: string = 'pending';
  private result: any = null;

  /**
   * 执行动作节点
   * @param node 工作流节点
   * @param context 执行上下文
   */
  async execute(node: WorkflowNode, context: any): Promise<ActionOutput> {
    try {
      this.status = 'running';
      
      // 获取动作实例
      const action = this.getAction(node);
      if (!action) {
        throw new Error(`Action not found in node: ${node.id}`);
      }

      // 执行动作
      const result = await action.run();
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
    return (
      node.type === 'action' &&
      !!node.config?.action
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
   * 从节点配置中获取动作实例
   * @param node 工作流节点
   */
  private getAction(node: WorkflowNode): Action | undefined {
    return node.config?.action as Action;
  }
} 