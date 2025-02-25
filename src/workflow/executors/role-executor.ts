import type { NodeExecutor, WorkflowNode } from '../../types/workflow';
import type { Role } from '../../types/role';
import type { Message } from '../../types/message';

/**
 * 角色节点执行器
 * 用于执行角色类型的工作流节点
 */
export class RoleNodeExecutor implements NodeExecutor {
  private status: string = 'pending';
  private result: any = null;

  /**
   * 执行角色节点
   * @param node 工作流节点
   * @param context 执行上下文
   */
  async execute(node: WorkflowNode, context: any): Promise<Message> {
    try {
      this.status = 'running';
      
      // 获取角色实例
      const role = this.getRole(node);
      if (!role) {
        throw new Error(`Role not found in node: ${node.id}`);
      }

      // 执行角色行为
      await role.observe();
      await role.think();
      const result = await role.act();
      
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
      node.type === 'role' &&
      !!node.config?.role
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
   * 从节点配置中获取角色实例
   * @param node 工作流节点
   */
  private getRole(node: WorkflowNode): Role | undefined {
    return node.config?.role as Role;
  }
} 