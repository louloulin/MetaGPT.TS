/**
 * TypeScript原生序列化系统
 * 
 * 充分利用TypeScript的类型系统、装饰器和泛型特性
 * 提供类型安全的序列化/反序列化功能
 */

import { z } from 'zod';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { logger } from '../utils/logger';

/**
 * 序列化配置选项
 */
export interface SerializationOptions {
  /** 是否美化JSON输出 */
  pretty?: boolean;
  /** 自定义文件扩展名 */
  extension?: string;
  /** 是否包含类型信息 */
  includeTypeInfo?: boolean;
}

/**
 * 可序列化接口
 * 使用TypeScript接口定义契约
 */
export interface Serializable<T = any> {
  /** 序列化为JSON字符串 */
  serialize(options?: SerializationOptions): Promise<string>;
  /** 获取序列化数据 */
  toSerializable(): Record<string, any>;
  /** 获取序列化文件路径 */
  getSerializationPath(): string;
}

/**
 * 序列化元数据
 */
interface SerializationMetadata {
  /** 字段配置 */
  fields: Map<string | symbol, FieldConfig>;
  /** 类型验证schema */
  schema?: z.ZodSchema;
  /** 版本信息 */
  version?: string;
}

/**
 * 字段配置
 */
interface FieldConfig {
  /** 是否序列化 */
  serialize: boolean;
  /** 字段别名 */
  alias?: string;
  /** 自定义序列化器 */
  serializer?: (value: any) => any;
  /** 自定义反序列化器 */
  deserializer?: (value: any) => any;
  /** 类型验证 */
  validator?: z.ZodSchema;
}

/**
 * 全局序列化注册表
 * 使用WeakMap确保内存安全
 */
const serializationRegistry = new WeakMap<Function, SerializationMetadata>();

/**
 * 类型注册表，用于多态反序列化
 */
const typeRegistry = new Map<string, Function>();

/**
 * 序列化字段装饰器
 * 充分利用TypeScript装饰器和反射
 */
export function SerializeField(config: Partial<FieldConfig> = {}) {
  return function (target: any, propertyKey: string | symbol) {
    const constructor = target.constructor;
    
    if (!serializationRegistry.has(constructor)) {
      serializationRegistry.set(constructor, {
        fields: new Map(),
      });
    }
    
    const metadata = serializationRegistry.get(constructor)!;
    metadata.fields.set(propertyKey, {
      serialize: true,
      ...config,
    });
  };
}

/**
 * 可序列化类装饰器
 * 注册类型并设置验证schema
 */
export function SerializableClass<T extends { new (...args: any[]): {} }>(
  options: {
    typeName?: string;
    schema?: z.ZodSchema;
    version?: string;
  } = {}
) {
  return function (constructor: T) {
    const typeName = options.typeName || constructor.name;
    
    // 注册类型
    typeRegistry.set(typeName, constructor);
    
    // 设置或更新元数据
    const existingMetadata = serializationRegistry.get(constructor) || { fields: new Map() };
    serializationRegistry.set(constructor, {
      ...existingMetadata,
      schema: options.schema,
      version: options.version,
    });
    
    return constructor;
  };
}

/**
 * 序列化混入类
 * 使用TypeScript的mixin模式
 */
export abstract class SerializationMixin implements Serializable {
  /**
   * 序列化为JSON字符串并保存到文件
   */
  async serialize(options: SerializationOptions = {}): Promise<string> {
    const filePath = this.getSerializationPath();
    
    // 确保目录存在
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    
    // 获取序列化数据
    const data = this.toSerializable();
    
    // 添加类型信息
    if (options.includeTypeInfo !== false) {
      data.__type = this.constructor.name;
      data.__version = this.getVersion();
    }
    
    // 序列化为JSON
    const jsonString = JSON.stringify(data, null, options.pretty ? 2 : 0);
    
    // 写入文件
    await writeFile(filePath, jsonString, 'utf8');
    
    logger.debug(`Serialized ${this.constructor.name} to ${filePath}`);
    return filePath;
  }

  /**
   * 获取可序列化的数据对象
   */
  toSerializable(): Record<string, any> {
    const result: Record<string, any> = {};

    // 添加类型信息
    result.__type = this.constructor.name;
    result.__version = this.getVersion();

    // 收集所有继承链上的序列化字段
    const allFields = this.getAllSerializableFields();

    if (allFields.size > 0) {
      // 使用装饰器配置的字段
      for (const [key, config] of allFields) {
        if (!config.serialize) continue;

        const value = (this as any)[key];
        if (value !== undefined) {
          const serializedValue = config.serializer
            ? config.serializer(value)
            : this.serializeValue(value);

          const fieldName = config.alias || String(key);
          result[fieldName] = serializedValue;
        }
      }
    } else {
      // 默认序列化所有可枚举属性
      for (const [key, value] of Object.entries(this)) {
        if (!key.startsWith('_') && value !== undefined) {
          result[key] = this.serializeValue(value);
        }
      }
    }

    return result;
  }

  /**
   * 获取所有可序列化字段（包括继承链）
   */
  private getAllSerializableFields(): Map<string | symbol, FieldConfig> {
    const allFields = new Map<string | symbol, FieldConfig>();

    // 遍历原型链
    let currentProto = this.constructor;
    while (currentProto && currentProto !== SerializationMixin) {
      const metadata = serializationRegistry.get(currentProto);
      if (metadata?.fields) {
        for (const [key, config] of metadata.fields) {
          if (!allFields.has(key)) {
            allFields.set(key, config);
          }
        }
      }
      currentProto = Object.getPrototypeOf(currentProto);
    }

    return allFields;
  }

  /**
   * 序列化单个值
   * 处理复杂类型和嵌套对象
   */
  protected serializeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }
    
    // 处理基本类型
    if (typeof value !== 'object') {
      return value;
    }
    
    // 处理特殊对象类型
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    
    if (value instanceof Set) {
      return { __type: 'Set', value: Array.from(value) };
    }
    
    if (value instanceof Map) {
      return { __type: 'Map', value: Array.from(value.entries()) };
    }
    
    if (value instanceof RegExp) {
      return { __type: 'RegExp', source: value.source, flags: value.flags };
    }
    
    // 处理数组
    if (Array.isArray(value)) {
      return value.map(item => this.serializeValue(item));
    }
    
    // 处理可序列化对象
    if (value.toSerializable && typeof value.toSerializable === 'function') {
      return value.toSerializable();
    }
    
    // 处理普通对象
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = this.serializeValue(val);
    }
    return result;
  }

  /**
   * 获取版本信息
   */
  protected getVersion(): string {
    const metadata = serializationRegistry.get(this.constructor);
    return metadata?.version || '1.0.0';
  }

  /**
   * 获取默认序列化路径
   */
  protected getDefaultSerializationPath(): string {
    const timestamp = Date.now();
    const className = this.constructor.name;
    return join(process.cwd(), 'serialized', `${className}_${timestamp}.json`);
  }

  /**
   * 抽象方法：获取序列化文件路径
   */
  abstract getSerializationPath(): string;
}

/**
 * 反序列化器类
 * 使用静态方法和泛型确保类型安全
 */
export class Deserializer {
  /**
   * 从文件反序列化对象
   */
  static async fromFile<T>(
    filePath: string,
    targetClass: new (...args: any[]) => T
  ): Promise<T> {
    const content = await readFile(filePath, 'utf8');
    return this.fromString(content, targetClass);
  }

  /**
   * 从JSON字符串反序列化对象
   */
  static fromString<T>(
    jsonString: string,
    targetClass: new (...args: any[]) => T
  ): T {
    const data = JSON.parse(jsonString);
    return this.fromObject(data, targetClass);
  }

  /**
   * 从对象数据反序列化
   */
  static fromObject<T>(
    data: Record<string, any>,
    targetClass: new (...args: any[]) => T
  ): T {
    // 检查类型信息
    if (data.__type && data.__type !== targetClass.name) {
      const registeredClass = typeRegistry.get(data.__type);
      if (registeredClass) {
        return this.fromObject(data, registeredClass as any) as T;
      }
    }

    // 移除元数据
    const { __type, __version, ...cleanData } = data;

    // 获取所有序列化字段（包括继承链）
    const allFields = this.getAllDeserializableFields(targetClass);
    const deserializedData: Record<string, any> = {};

    if (allFields.size > 0) {
      // 使用装饰器配置反序列化
      for (const [key, config] of allFields) {
        if (!config.serialize) continue;

        const fieldName = config.alias || String(key);
        const value = cleanData[fieldName];

        if (value !== undefined) {
          deserializedData[String(key)] = config.deserializer
            ? config.deserializer(value)
            : this.deserializeValue(value);
        }
      }
    } else {
      // 直接使用数据
      for (const [key, value] of Object.entries(cleanData)) {
        deserializedData[key] = this.deserializeValue(value);
      }
    }

    // 创建实例
    const instance = Object.create(targetClass.prototype);
    Object.assign(instance, deserializedData);

    // 验证数据
    const metadata = serializationRegistry.get(targetClass);
    if (metadata?.schema) {
      try {
        metadata.schema.parse(instance);
      } catch (error) {
        logger.warn(`Validation failed for ${targetClass.name}:`, error);
      }
    }

    return instance;
  }

  /**
   * 获取所有可反序列化字段（包括继承链）
   */
  private static getAllDeserializableFields(targetClass: Function): Map<string | symbol, FieldConfig> {
    const allFields = new Map<string | symbol, FieldConfig>();

    // 遍历原型链
    let currentProto = targetClass;
    while (currentProto && currentProto !== SerializationMixin) {
      const metadata = serializationRegistry.get(currentProto);
      if (metadata?.fields) {
        for (const [key, config] of metadata.fields) {
          if (!allFields.has(key)) {
            allFields.set(key, config);
          }
        }
      }
      currentProto = Object.getPrototypeOf(currentProto);
    }

    return allFields;
  }

  /**
   * 反序列化单个值
   */
  private static deserializeValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== 'object') {
      return value;
    }

    // 处理特殊类型
    if (value.__type) {
      switch (value.__type) {
        case 'Date':
          return new Date(value.value);
        case 'Set':
          return new Set(value.value.map((item: any) => this.deserializeValue(item)));
        case 'Map':
          return new Map(value.value.map(([k, v]: [any, any]) => [
            this.deserializeValue(k),
            this.deserializeValue(v)
          ]));
        case 'RegExp':
          return new RegExp(value.source, value.flags);
        default:
          return value;
      }
    }

    // 处理数组
    if (Array.isArray(value)) {
      return value.map(item => this.deserializeValue(item));
    }

    // 处理普通对象
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = this.deserializeValue(val);
    }
    return result;
  }
}

/**
 * 序列化工具函数
 */
export const SerializationUtils = {
  /**
   * 注册自定义类型
   */
  registerType(typeName: string, constructor: Function): void {
    typeRegistry.set(typeName, constructor);
  },

  /**
   * 获取已注册的类型
   */
  getRegisteredTypes(): string[] {
    return Array.from(typeRegistry.keys());
  },

  /**
   * 清除类型注册表
   */
  clearRegistry(): void {
    typeRegistry.clear();
  },

  /**
   * 创建带验证的序列化类装饰器
   */
  createValidatedSerializable<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
    return function <U extends { new (...args: any[]): {} }>(constructor: U) {
      return SerializableClass({
        schema,
        version: '1.0.0'
      })(constructor);
    };
  },
};
