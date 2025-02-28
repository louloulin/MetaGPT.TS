/**
 * 测试JSON解析功能
 * 
 * 这个脚本用于测试我们的JSON解析功能，特别是使用Zod进行验证的部分
 */

import { z } from 'zod';
import { 
  parseJson, 
  parseJsonWithZod, 
  safeParseJsonWithZod, 
  parseCodeBlockJsonWithZod,
  extractAndValidateJson
} from '../utils/common';

// 定义一个简单的Zod模式
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
  roles: z.array(z.string())
});

type User = z.infer<typeof UserSchema>;

// 测试正常的JSON
const validJson = `{
  "id": 1,
  "name": "张三",
  "email": "zhangsan@example.com",
  "roles": ["user", "admin"]
}`;

// 测试包含代码块的JSON
const jsonInCodeBlock = "```json\n" + validJson + "\n```";

// 测试包含额外文本的JSON
const jsonWithExtraText = `
这是一个用户信息：

${validJson}

以上是用户的基本信息。
`;

// 测试缺少必填字段的JSON
const invalidJson = `{
  "id": 1,
  "name": "张三",
  "roles": ["user", "admin"]
}`;

// 测试格式错误的JSON
const malformedJson = `{
  "id": 1,
  "name": "张三",
  "email": "zhangsan@example.com",
  "roles": ["user", "admin"
}`;

// 运行测试
async function runTests() {
  console.log('=== 测试JSON解析功能 ===');

  // 测试1: 解析有效的JSON
  try {
    console.log('\n测试1: 解析有效的JSON');
    const user = parseJsonWithZod<User>(validJson, UserSchema);
    console.log('成功解析:', user);
  } catch (error) {
    console.error('解析失败:', error);
  }

  // 测试2: 解析代码块中的JSON
  try {
    console.log('\n测试2: 解析代码块中的JSON');
    const user = parseCodeBlockJsonWithZod<User>(jsonInCodeBlock, UserSchema);
    console.log('成功解析:', user);
  } catch (error) {
    console.error('解析失败:', error);
  }

  // 测试3: 从文本中提取并验证JSON
  try {
    console.log('\n测试3: 从文本中提取并验证JSON');
    const user = extractAndValidateJson<User>(jsonWithExtraText, UserSchema);
    console.log('成功解析:', user);
  } catch (error) {
    console.error('解析失败:', error);
  }

  // 测试4: 安全解析无效的JSON
  try {
    console.log('\n测试4: 安全解析无效的JSON');
    const result = safeParseJsonWithZod<User>(invalidJson, UserSchema);
    if (result.success) {
      console.log('成功解析:', result.data);
    } else {
      console.log('验证失败:', result.error);
    }
  } catch (error) {
    console.error('解析失败:', error);
  }

  // 测试5: 解析格式错误的JSON
  try {
    console.log('\n测试5: 解析格式错误的JSON');
    const user = parseJson<User>(malformedJson);
    console.log('成功解析:', user);
  } catch (error: any) {
    console.log('解析失败 (预期结果):', error.message);
  }

  // 测试6: 使用默认值解析无效的JSON
  try {
    console.log('\n测试6: 使用默认值解析无效的JSON');
    const defaultUser: User = {
      id: 0,
      name: '默认用户',
      email: 'default@example.com',
      roles: ['user']
    };
    const user = parseJsonWithZod<User>(invalidJson, UserSchema, defaultUser);
    console.log('使用默认值:', user);
  } catch (error) {
    console.error('解析失败:', error);
  }
}

// 运行测试
runTests().catch(console.error); 