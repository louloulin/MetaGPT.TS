/**
 * TypeScript序列化系统测试
 * 测试类型安全、装饰器和泛型功能
 */

import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { join } from 'path';
import { 
  SerializationMixin, 
  SerializeField, 
  SerializableClass,
  Deserializer,
  SerializationUtils
} from '../serialization';

// 定义用户数据验证schema
const UserSchema = z.object({
  name: z.string(),
  age: z.number().min(0).max(150),
  email: z.string().email(),
  isActive: z.boolean().default(true),
});

// 使用TypeScript类型推导
type UserType = z.infer<typeof UserSchema>;

// 测试用的用户类 - 充分利用TypeScript特性
@SerializableClass({ 
  typeName: 'User',
  schema: UserSchema,
  version: '1.0.0'
})
class User extends SerializationMixin implements UserType {
  @SerializeField()
  name: string;

  @SerializeField()
  age: number;

  @SerializeField({ alias: 'email_address' })
  email: string;

  @SerializeField({ serialize: false })
  private password: string;

  @SerializeField()
  isActive: boolean = true;

  @SerializeField({ 
    serializer: (date: Date) => date.toISOString(),
    deserializer: (str: string) => new Date(str)
  })
  createdAt: Date;

  constructor(name: string, age: number, email: string, password: string) {
    super();
    this.name = name;
    this.age = age;
    this.email = email;
    this.password = password;
    this.createdAt = new Date();
  }

  getSerializationPath(): string {
    return join(process.cwd(), 'test_data', `user_${this.name}.json`);
  }

  // TypeScript getter/setter
  get displayName(): string {
    return `${this.name} (${this.age})`;
  }
}

// 测试复杂类型
@SerializableClass({ typeName: 'Project' })
class Project extends SerializationMixin {
  @SerializeField()
  id: string;

  @SerializeField()
  title: string;

  @SerializeField()
  tags: Set<string> = new Set();

  @SerializeField()
  metadata: Map<string, any> = new Map();

  @SerializeField()
  members: User[] = [];

  @SerializeField()
  config: Record<string, any> = {};

  constructor(id: string, title: string) {
    super();
    this.id = id;
    this.title = title;
  }

  getSerializationPath(): string {
    return join(process.cwd(), 'test_data', `project_${this.id}.json`);
  }

  // TypeScript方法
  addMember(user: User): void {
    this.members.push(user);
  }

  addTag(tag: string): void {
    this.tags.add(tag);
  }
}

// 测试继承
@SerializableClass({ typeName: 'AdminUser' })
class AdminUser extends User {
  @SerializeField()
  permissions: string[] = [];

  @SerializeField()
  lastLogin?: Date;

  constructor(name: string, age: number, email: string, password: string, permissions: string[]) {
    super(name, age, email, password);
    this.permissions = permissions;
  }

  getSerializationPath(): string {
    return join(process.cwd(), 'test_data', `admin_${this.name}.json`);
  }

  // TypeScript方法重载
  hasPermission(permission: string): boolean;
  hasPermission(permissions: string[]): boolean;
  hasPermission(permissionOrPermissions: string | string[]): boolean {
    if (typeof permissionOrPermissions === 'string') {
      return this.permissions.includes(permissionOrPermissions);
    }
    return permissionOrPermissions.every(p => this.permissions.includes(p));
  }
}

describe('TypeScript序列化系统测试', () => {
  // 注意：不要在每个测试前清理注册表，因为装饰器在类定义时就注册了类型

  describe('基础序列化功能', () => {
    it('应该能够序列化用户对象', () => {
      const user = new User('Alice', 30, 'alice@example.com', 'secret123');
      const data = user.toSerializable();
      
      expect(data.__type).toBe('User');
      expect(data.__version).toBe('1.0.0');
      expect(data.name).toBe('Alice');
      expect(data.age).toBe(30);
      expect(data.email_address).toBe('alice@example.com'); // 使用别名
      expect(data.password).toBeUndefined(); // 应该被排除
      expect(data.isActive).toBe(true);
      expect(typeof data.createdAt).toBe('string'); // 自定义序列化器
    });

    it('应该能够反序列化用户对象', () => {
      const originalUser = new User('Bob', 25, 'bob@example.com', 'secret456');
      const data = originalUser.toSerializable();
      
      const deserializedUser = Deserializer.fromObject(data, User);
      
      expect(deserializedUser).toBeInstanceOf(User);
      expect(deserializedUser.name).toBe('Bob');
      expect(deserializedUser.age).toBe(25);
      expect(deserializedUser.email).toBe('bob@example.com');
      expect(deserializedUser.isActive).toBe(true);
      expect(deserializedUser.createdAt).toBeInstanceOf(Date); // 自定义反序列化器
      expect(deserializedUser.displayName).toBe('Bob (25)'); // getter应该工作
    });
  });

  describe('复杂类型序列化', () => {
    it('应该能够序列化包含复杂类型的项目', () => {
      const project = new Project('proj-001', 'Test Project');
      project.addTag('typescript');
      project.addTag('testing');
      project.metadata.set('version', '1.0.0');
      project.metadata.set('priority', 'high');
      project.config = { debug: true, maxRetries: 3 };
      
      const user1 = new User('User1', 20, 'user1@test.com', 'pass1');
      const user2 = new User('User2', 30, 'user2@test.com', 'pass2');
      project.addMember(user1);
      project.addMember(user2);
      
      const data = project.toSerializable();
      
      expect(data.id).toBe('proj-001');
      expect(data.title).toBe('Test Project');
      expect(data.tags.__type).toBe('Set');
      expect(data.tags.value).toContain('typescript');
      expect(data.metadata.__type).toBe('Map');
      expect(data.members).toHaveLength(2);
      expect(data.config.debug).toBe(true);
    });

    it('应该能够反序列化复杂项目对象', () => {
      const originalProject = new Project('proj-002', 'Complex Project');
      originalProject.addTag('complex');
      originalProject.metadata.set('complexity', 'high');
      
      const data = originalProject.toSerializable();
      const deserializedProject = Deserializer.fromObject(data, Project);
      
      expect(deserializedProject).toBeInstanceOf(Project);
      expect(deserializedProject.id).toBe('proj-002');
      expect(deserializedProject.title).toBe('Complex Project');
      expect(deserializedProject.tags).toBeInstanceOf(Set);
      expect(deserializedProject.tags.has('complex')).toBe(true);
      expect(deserializedProject.metadata).toBeInstanceOf(Map);
      expect(deserializedProject.metadata.get('complexity')).toBe('high');
    });
  });

  describe('继承和多态', () => {
    it('应该能够序列化管理员用户', () => {
      const admin = new AdminUser('Admin', 35, 'admin@test.com', 'adminpass', ['read', 'write', 'delete']);
      admin.lastLogin = new Date('2023-01-01');
      
      const data = admin.toSerializable();
      
      expect(data.__type).toBe('AdminUser');
      expect(data.name).toBe('Admin');
      expect(data.permissions).toEqual(['read', 'write', 'delete']);
      expect(data.lastLogin.__type).toBe('Date');
    });

    it('应该能够正确处理多态反序列化', () => {
      const admin = new AdminUser('SuperAdmin', 40, 'super@test.com', 'superpass', ['admin']);
      const data = admin.toSerializable();
      
      // 使用基类反序列化，应该得到正确的子类实例
      const deserializedAdmin = Deserializer.fromObject(data, User) as AdminUser;
      
      expect(deserializedAdmin).toBeInstanceOf(AdminUser);
      expect(deserializedAdmin.name).toBe('SuperAdmin');
      expect(deserializedAdmin.permissions).toEqual(['admin']);
      expect(deserializedAdmin.hasPermission('admin')).toBe(true);
      expect(deserializedAdmin.hasPermission(['admin', 'read'])).toBe(false);
    });
  });

  describe('类型安全和验证', () => {
    it('应该支持Zod schema验证', () => {
      // 这个测试验证了TypeScript类型系统和Zod的集成
      const validUser = new User('ValidUser', 25, 'valid@test.com', 'pass');
      expect(() => validUser.toSerializable()).not.toThrow();
      
      // 注意：实际的验证在反序列化时进行
      const data = validUser.toSerializable();
      const deserializedUser = Deserializer.fromObject(data, User);
      expect(deserializedUser.name).toBe('ValidUser');
    });

    it('应该支持工具函数', () => {
      SerializationUtils.registerType('CustomUser', User);
      
      const types = SerializationUtils.getRegisteredTypes();
      expect(types).toContain('CustomUser');
      
      SerializationUtils.clearRegistry();
      const clearedTypes = SerializationUtils.getRegisteredTypes();
      expect(clearedTypes).not.toContain('CustomUser');
    });
  });

  describe('TypeScript特性测试', () => {
    it('应该保持类型安全', () => {
      const user = new User('TypeSafe', 30, 'type@safe.com', 'pass');
      
      // TypeScript编译时类型检查
      expect(typeof user.name).toBe('string');
      expect(typeof user.age).toBe('number');
      expect(typeof user.isActive).toBe('boolean');
      expect(user.createdAt).toBeInstanceOf(Date);
      
      // getter应该工作
      expect(user.displayName).toBe('TypeSafe (30)');
    });

    it('应该支持方法重载', () => {
      const admin = new AdminUser('OverloadTest', 30, 'test@test.com', 'pass', ['read', 'write']);
      
      // 单个权限检查
      expect(admin.hasPermission('read')).toBe(true);
      expect(admin.hasPermission('delete')).toBe(false);
      
      // 多个权限检查
      expect(admin.hasPermission(['read', 'write'])).toBe(true);
      expect(admin.hasPermission(['read', 'delete'])).toBe(false);
    });
  });
});
