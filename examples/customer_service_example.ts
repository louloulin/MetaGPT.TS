import { CustomerService } from '../src/roles/customer-service';
import { logger } from '../src/utils/logger';
import { UserMessage } from '../src/types/message';
import { createLLMProvider } from '../../examples/utils/llm-provider';
import { SearchProviderType } from '../src/config/search';

// @ts-ignore
declare const process: any;

async function main() {
  // 创建 LLM Provider
  const provider = createLLMProvider(
    '你是一位专业的客服代表，擅长解决客户问题并提供优质服务。请保持友好、耐心，并确保回答准确且有帮助。'
  );

  // 创建 CustomerService 实例
  const customerService = new CustomerService({
    llm: provider,
    name: 'Tech Support',
    profile: '技术支持代表',
    goal: '提供专业的技术支持和问题解决方案',
    constraints: '保持专业、友好，确保信息准确性',
    searchProvider: SearchProviderType.SERPAPI,
    faqDatabase: `
      常见问题解答：
      Q: 支持哪些操作系统？
      A: 我们支持 Windows、macOS 和 Linux。

      Q: 如何重置密码？
      A: 请访问登录页面，点击"忘记密码"链接。

      Q: 技术支持响应时间是多久？
      A: 普通问题24小时内，紧急问题4小时内。
    `,
    supportTemplates: {
      'connection': '连接问题排查步骤：\n1. 检查网络连接\n2. 确认服务器状态\n3. 检查防火墙设置',
      'error': '错误排查步骤：\n1. 检查错误日志\n2. 验证配置文件\n3. 重启应用程序',
      'upgrade': '升级流程：\n1. 备份数据\n2. 下载新版本\n3. 按照升级指南操作'
    }
  });

  // 示例 1: 产品咨询
  logger.info('=== 产品咨询 ===');
  const inquiry = new UserMessage('你们的软件支持哪些操作系统？');
  customerService.context.memory.add(inquiry);
  await customerService.think();
  const todo = customerService.context.todo;
  if (todo) {
    const response = await todo.run();
    logger.info('回答:', response);
  }

  // 示例 2: 技术支持
  logger.info('\n=== 技术支持 ===');
  const support = new UserMessage('我的应用程序启动时报错，错误信息是：Connection refused');
  customerService.context.memory.add(support);
  await customerService.think();
  const supportTodo = customerService.context.todo;
  if (supportTodo) {
    const solution = await supportTodo.run();
    logger.info('解决方案:', solution);
  }

  // 示例 3: 投诉处理
  logger.info('\n=== 投诉处理 ===');
  const complaint = new UserMessage('我已经等待技术支持超过48小时了，但还没有人联系我。');
  customerService.context.memory.add(complaint);
  await customerService.think();
  const complaintTodo = customerService.context.todo;
  if (complaintTodo) {
    const resolution = await complaintTodo.run();
    logger.info('处理结果:', resolution);
  }

  // 示例 4: 服务升级
  logger.info('\n=== 服务升级 ===');
  const upgrade = new UserMessage(`
    我是企业客户，想了解：
    1. 企业版有哪些额外功能？
    2. 升级流程是怎样的？
    3. 价格方案如何？
  `);
  customerService.context.memory.add(upgrade);
  await customerService.think();
  const upgradeTodo = customerService.context.todo;
  if (upgradeTodo) {
    const info = await upgradeTodo.run();
    logger.info('升级信息:', info);
  }
}

// 运行示例
main().catch(error => {
  logger.error('运行出错:', error);
  process.exit(1);
}); 