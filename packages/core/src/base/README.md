# MetaGPT.TS 序列化系统

## 概述

MetaGPT.TS 序列化系统是一个充分利用 TypeScript 特性的类型安全序列化/反序列化框架。它提供了装饰器驱动的配置、多态支持、继承链处理和 Zod 集成验证。

## 核心特性

### 🎯 TypeScript 原生设计
- 充分利用装饰器、泛型和类型推导
- 类型安全的 API 设计
- 支持方法重载和高级 TypeScript 特性

### 🔧 装饰器驱动
- `@SerializableClass` - 类级别配置
- `@SerializeField` - 字段级别配置
- 支持自定义序列化器和反序列化器

### 🏗️ 继承支持
- 自动处理继承链上的字段
- 多态序列化和反序列化
- 保持类型信息和实例方法

### ✅ 类型验证
- 集成 Zod 进行运行时验证
- 版本兼容性处理
- 错误处理和日志记录

## 快速开始

### 1. 基础使用

```typescript
import { 
  SerializationMixin, 
  SerializeField, 
  SerializableClass,
  Deserializer 
} from '@metagpt/core';

@SerializableClass({ 
  typeName: 'User',
  version: '1.0.0'
})
class User extends SerializationMixin {
  @SerializeField()
  name: string;

  @SerializeField()
  age: number;

  @SerializeField({ alias: 'email_address' })
  email: string;

  @SerializeField({ serialize: false })
  private password: string;

  constructor(name: string, age: number, email: string, password: string) {
    super();
    this.name = name;
    this.age = age;
    this.email = email;
    this.password = password;
  }

  getSerializationPath(): string {
    return `./data/users/${this.name}.json`;
  }
}

// 使用示例
const user = new User('Alice', 30, 'alice@example.com', 'secret');

// 序列化
const data = user.toSerializable();
const filePath = await user.serialize({ pretty: true });

// 反序列化
const deserializedUser = Deserializer.fromObject(data, User);
const loadedUser = await Deserializer.fromFile(filePath, User);
```

### 2. 复杂类型支持

```typescript
@SerializableClass({ typeName: 'Project' })
class Project extends SerializationMixin {
  @SerializeField()
  id: string;

  @SerializeField()
  tags: Set<string> = new Set();

  @SerializeField()
  metadata: Map<string, any> = new Map();

  @SerializeField()
  members: User[] = [];

  @SerializeField({
    serializer: (date: Date) => date.toISOString(),
    deserializer: (str: string) => new Date(str)
  })
  createdAt: Date;

  constructor(id: string) {
    super();
    this.id = id;
    this.createdAt = new Date();
  }

  getSerializationPath(): string {
    return `./data/projects/${this.id}.json`;
  }
}
```

### 3. 继承和多态

```typescript
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

  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission);
  }
}

// 多态使用
const admin = new AdminUser('Admin', 35, 'admin@test.com', 'pass', ['read', 'write']);
const data = admin.toSerializable(); // __type: 'AdminUser'

// 使用基类反序列化，自动识别正确的子类
const deserializedAdmin = Deserializer.fromObject(data, User) as AdminUser;
console.log(deserializedAdmin instanceof AdminUser); // true
```

### 4. Zod 验证集成

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0).max(150),
  email: z.string().email(),
});

@SerializableClass({ 
  typeName: 'ValidatedUser',
  schema: UserSchema,
  version: '1.0.0'
})
class ValidatedUser extends SerializationMixin {
  @SerializeField()
  name: string;

  @SerializeField()
  age: number;

  @SerializeField()
  email: string;

  // ... 构造函数和其他方法
}
```

## API 参考

### 装饰器

#### `@SerializableClass(options?)`
类级别装饰器，用于配置序列化行为。

**选项：**
- `typeName?: string` - 自定义类型名称
- `schema?: z.ZodSchema` - Zod 验证模式
- `version?: string` - 版本信息

#### `@SerializeField(config?)`
字段级别装饰器，用于配置字段序列化。

**配置：**
- `serialize?: boolean` - 是否序列化（默认 true）
- `alias?: string` - 字段别名
- `serializer?: (value: any) => any` - 自定义序列化器
- `deserializer?: (value: any) => any` - 自定义反序列化器

### 核心类

#### `SerializationMixin`
序列化混入基类，提供核心序列化功能。

**方法：**
- `serialize(options?)` - 序列化到文件
- `toSerializable()` - 获取序列化数据
- `getSerializationPath()` - 获取文件路径（抽象方法）

#### `Deserializer`
静态反序列化工具类。

**方法：**
- `fromFile<T>(filePath, targetClass)` - 从文件反序列化
- `fromString<T>(jsonString, targetClass)` - 从 JSON 字符串反序列化
- `fromObject<T>(data, targetClass)` - 从对象数据反序列化

### 工具函数

#### `SerializationUtils`
序列化工具函数集合。

**方法：**
- `registerType(typeName, constructor)` - 注册自定义类型
- `getRegisteredTypes()` - 获取已注册类型
- `clearRegistry()` - 清除类型注册表
- `createValidatedSerializable(schema)` - 创建带验证的装饰器

## 最佳实践

### 1. 字段配置
- 使用 `serialize: false` 排除敏感信息
- 为复杂字段提供自定义序列化器
- 使用别名保持 API 兼容性

### 2. 继承设计
- 在子类中重新应用 `@SerializableClass` 装饰器
- 确保子类字段都有 `@SerializeField` 装饰器
- 考虑版本兼容性

### 3. 性能优化
- 使用 WeakMap 存储元数据，避免内存泄漏
- 对大型对象考虑分块序列化
- 缓存序列化结果

### 4. 错误处理
- 实现适当的错误处理和日志记录
- 使用 Zod 验证确保数据完整性
- 提供降级策略

## 与 Python 版本的差异

1. **类型安全**：TypeScript 版本提供编译时类型检查
2. **装饰器设计**：更符合 TypeScript 装饰器规范
3. **内存管理**：使用 WeakMap 避免内存泄漏
4. **验证集成**：原生集成 Zod 而非 Pydantic
5. **异步支持**：原生支持 Promise/async-await

## 示例项目

查看 `src/examples/serialization-example.ts` 获取完整的使用示例。
