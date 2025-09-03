/**
 * 序列化系统使用示例
 * 展示如何在MetaGPT.TS中使用TypeScript风格的序列化功能
 */

import { z } from 'zod';
import { join } from 'path';
import { 
  SerializationMixin, 
  SerializeField, 
  SerializableClass,
  Deserializer,
  SerializationUtils
} from '../base/serialization';

// 定义消息schema
const MessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  role: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
});

// 可序列化的消息类
@SerializableClass({ 
  typeName: 'SerializableMessage',
  schema: MessageSchema,
  version: '1.0.0'
})
class SerializableMessage extends SerializationMixin {
  @SerializeField()
  id: string;

  @SerializeField()
  content: string;

  @SerializeField()
  role: string;

  @SerializeField({
    serializer: (date: Date) => date.toISOString(),
    deserializer: (str: string) => new Date(str)
  })
  timestamp: Date;

  @SerializeField()
  metadata?: Record<string, any>;

  constructor(id: string, content: string, role: string = 'user') {
    super();
    this.id = id;
    this.content = content;
    this.role = role;
    this.timestamp = new Date();
  }

  getSerializationPath(): string {
    return join(process.cwd(), 'serialized', 'messages', `message_${this.id}.json`);
  }
}

// 可序列化的角色类
@SerializableClass({ 
  typeName: 'SerializableRole',
  version: '1.0.0'
})
class SerializableRole extends SerializationMixin {
  @SerializeField()
  name: string;

  @SerializeField()
  profile: string;

  @SerializeField()
  goal: string;

  @SerializeField()
  constraints: string;

  @SerializeField()
  messages: SerializableMessage[] = [];

  @SerializeField()
  state: string = 'idle';

  @SerializeField({ serialize: false })
  private _internalState: any = {};

  constructor(name: string, profile: string, goal: string, constraints: string) {
    super();
    this.name = name;
    this.profile = profile;
    this.goal = goal;
    this.constraints = constraints;
  }

  addMessage(message: SerializableMessage): void {
    this.messages.push(message);
  }

  getSerializationPath(): string {
    return join(process.cwd(), 'serialized', 'roles', `role_${this.name}.json`);
  }
}

// 可序列化的团队类
@SerializableClass({ 
  typeName: 'SerializableTeam',
  version: '1.0.0'
})
class SerializableTeam extends SerializationMixin {
  @SerializeField()
  id: string;

  @SerializeField()
  name: string;

  @SerializeField()
  roles: SerializableRole[] = [];

  @SerializeField()
  config: Map<string, any> = new Map();

  @SerializeField()
  createdAt: Date;

  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name;
    this.createdAt = new Date();
  }

  addRole(role: SerializableRole): void {
    this.roles.push(role);
  }

  setConfig(key: string, value: any): void {
    this.config.set(key, value);
  }

  getSerializationPath(): string {
    return join(process.cwd(), 'serialized', 'teams', `team_${this.id}.json`);
  }
}

/**
 * 序列化系统使用示例
 */
export async function serializationExample() {
  console.log('🚀 MetaGPT.TS 序列化系统示例');
  
  // 1. 创建消息
  const message1 = new SerializableMessage('msg-001', '请帮我设计一个用户管理系统', 'user');
  const message2 = new SerializableMessage('msg-002', '我将为您设计一个完整的用户管理系统', 'assistant');
  message2.metadata = { confidence: 0.95, tokens: 150 };

  // 2. 创建角色
  const productManager = new SerializableRole(
    'ProductManager',
    'Product Manager',
    '定义产品需求和功能规格',
    '专注于用户价值和业务目标'
  );
  
  const architect = new SerializableRole(
    'Architect',
    'System Architect', 
    '设计系统架构和技术方案',
    '确保系统的可扩展性和可维护性'
  );

  // 3. 添加消息到角色
  productManager.addMessage(message1);
  architect.addMessage(message2);

  // 4. 创建团队
  const team = new SerializableTeam('team-001', 'User Management System Team');
  team.addRole(productManager);
  team.addRole(architect);
  team.setConfig('maxRounds', 5);
  team.setConfig('budget', 1000);

  // 5. 序列化演示
  console.log('\n📝 序列化演示:');
  
  // 序列化消息
  const messageData = message1.toSerializable();
  console.log('消息序列化:', JSON.stringify(messageData, null, 2));
  
  // 序列化角色
  const roleData = productManager.toSerializable();
  console.log('角色序列化 (部分):', {
    __type: roleData.__type,
    name: roleData.name,
    profile: roleData.profile,
    messagesCount: roleData.messages?.length || 0
  });

  // 序列化团队
  const teamData = team.toSerializable();
  console.log('团队序列化 (部分):', {
    __type: teamData.__type,
    name: teamData.name,
    rolesCount: teamData.roles?.length || 0,
    config: teamData.config
  });

  // 6. 反序列化演示
  console.log('\n🔄 反序列化演示:');
  
  // 反序列化消息
  const deserializedMessage = Deserializer.fromObject(messageData, SerializableMessage);
  console.log('反序列化消息:', {
    id: deserializedMessage.id,
    content: deserializedMessage.content,
    timestamp: deserializedMessage.timestamp,
    isDateInstance: deserializedMessage.timestamp instanceof Date
  });

  // 反序列化角色
  const deserializedRole = Deserializer.fromObject(roleData, SerializableRole);
  console.log('反序列化角色:', {
    name: deserializedRole.name,
    profile: deserializedRole.profile,
    messagesCount: deserializedRole.messages.length,
    firstMessageContent: deserializedRole.messages[0]?.content
  });

  // 7. 多态序列化演示
  console.log('\n🔀 多态序列化演示:');
  
  // 使用基类引用
  const roles: SerializationMixin[] = [productManager, architect];
  
  for (const role of roles) {
    const data = role.toSerializable();
    console.log(`${data.__type}: ${data.name}`);
    
    // 多态反序列化
    const deserialized = Deserializer.fromObject(data, SerializableRole);
    console.log(`反序列化类型: ${deserialized.constructor.name}`);
  }

  // 8. 文件序列化演示
  console.log('\n💾 文件序列化演示:');
  
  try {
    // 保存到文件
    const teamFilePath = await team.serialize({ pretty: true });
    console.log(`团队已序列化到: ${teamFilePath}`);
    
    // 从文件加载
    const loadedTeam = await Deserializer.fromFile(teamFilePath, SerializableTeam);
    console.log('从文件加载的团队:', {
      name: loadedTeam.name,
      rolesCount: loadedTeam.roles.length,
      configSize: loadedTeam.config.size
    });
    
  } catch (error) {
    console.error('文件序列化错误:', error);
  }

  // 9. 工具函数演示
  console.log('\n🛠️ 工具函数演示:');
  
  const registeredTypes = SerializationUtils.getRegisteredTypes();
  console.log('已注册的类型:', registeredTypes);

  console.log('\n✅ 序列化系统示例完成!');
}

// 如果直接运行此文件
if (import.meta.main) {
  serializationExample().catch(console.error);
}
