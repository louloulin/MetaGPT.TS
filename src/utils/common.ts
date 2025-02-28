/**
 * Common utility functions used throughout the application
 */
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

/**
 * 将任意值转换为字符串
 * @param value 要转换的值
 * @returns 字符串表示
 */
export function anyToString(value: any): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return 'function: ' + (value.name || '(anonymous)');
  if (typeof value === 'object') {
    if (value instanceof Date) return 'Date: ' + value.toString();
    try {
      return value.toString() || JSON.stringify(value);
    } catch (e) {
      return Object.prototype.toString.call(value);
    }
  }
  return String(value);
}

/**
 * 将任意值转换为字符串集合
 * @param value 要转换的值
 * @returns 字符串集合
 */
export function anyToStringSet(value: any): Set<string> {
  if (value instanceof Set) {
    return new Set([...value].map(anyToString));
  }
  if (Array.isArray(value)) {
    return new Set(value.map(anyToString));
  }
  return new Set([anyToString(value)]);
}

/**
 * Generate a unique ID
 * @returns Unique ID string
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Sleep for a specified duration
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a value is null or undefined
 * @param value - Value to check
 * @returns True if the value is null or undefined
 */
export function isNullOrUndefined(value: any): boolean {
  return value === null || value === undefined;
}

/**
 * 安全解析JSON字符串
 * @param text - 要解析的JSON字符串
 * @param defaultValue - 解析失败时返回的默认值
 * @returns 解析后的对象或默认值
 */
export function safeJsonParse<T>(text: string, defaultValue: T): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * 增强版JSON解析函数，能够处理各种格式的JSON字符串
 * @param text - 要解析的文本
 * @returns 解析后的对象
 * @throws 如果无法解析则抛出错误
 */
export function parseJson<T>(text: string): T {
  // 尝试直接解析
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    // 如果直接解析失败，尝试清理文本后再解析
    const cleanedText = cleanJsonString(text);
    try {
      return JSON.parse(cleanedText) as T;
    } catch (e2) {
      // 如果仍然失败，尝试从文本中提取JSON部分
      const extractedJson = extractJsonFromText(text);
      if (extractedJson) {
        try {
          return JSON.parse(extractedJson) as T;
        } catch (e3: any) {
          throw new Error(`无法解析JSON: ${e3.message}`);
        }
      }
      throw new Error(`无法解析JSON: ${(e2 as Error).message}`);
    }
  }
}

/**
 * 清理JSON字符串，移除可能导致解析错误的字符
 * @param text - 要清理的JSON字符串
 * @returns 清理后的JSON字符串
 */
export function cleanJsonString(text: string): string {
  // 移除反引号代码块
  let cleaned = text.replace(/```(json)?\s*([\s\S]*?)\s*```/g, '$2');
  
  // 移除前后可能的非JSON文本
  cleaned = cleaned.trim();
  
  // 如果字符串不是以{或[开头，尝试找到第一个{或[
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  
  let startIndex = -1;
  if (firstBrace >= 0 && firstBracket >= 0) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace >= 0) {
    startIndex = firstBrace;
  } else if (firstBracket >= 0) {
    startIndex = firstBracket;
  }
  
  if (startIndex > 0) {
    cleaned = cleaned.substring(startIndex);
  }
  
  // 如果字符串不是以}或]结尾，尝试找到最后一个}或]
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  
  let endIndex = -1;
  if (lastBrace >= 0 && lastBracket >= 0) {
    endIndex = Math.max(lastBrace, lastBracket);
  } else if (lastBrace >= 0) {
    endIndex = lastBrace;
  } else if (lastBracket >= 0) {
    endIndex = lastBracket;
  }
  
  if (endIndex >= 0 && endIndex < cleaned.length - 1) {
    cleaned = cleaned.substring(0, endIndex + 1);
  }
  
  return cleaned;
}

/**
 * 从文本中提取JSON部分
 * @param text - 包含JSON的文本
 * @returns 提取的JSON字符串，如果没有找到则返回null
 */
export function extractJsonFromText(text: string): string | null {
  // 尝试匹配JSON对象
  const objectMatch = text.match(/(\{[\s\S]*\})/);
  if (objectMatch) {
    return objectMatch[1];
  }
  
  // 尝试匹配JSON数组
  const arrayMatch = text.match(/(\[[\s\S]*\])/);
  if (arrayMatch) {
    return arrayMatch[1];
  }
  
  return null;
}

/**
 * 解析代码块，从文本中提取指定语言的代码块
 * @param text - 包含代码块的文本
 * @param lang - 代码块的语言标识，默认为空
 * @returns 提取的代码内容
 */
export function parseCodeBlock(text: string, lang: string = ''): string {
  const pattern = new RegExp(`\`\`\`${lang}.*?\\s+(.*?)\`\`\``, 's');
  const match = pattern.exec(text);
  if (match) {
    return match[1];
  }
  return text; // 如果没有找到代码块，返回原始文本
}

/**
 * 解析文本块，将文本按照##分割成不同的块
 * @param text - 要解析的文本
 * @returns 解析后的块字典，键为块标题，值为块内容
 */
export function parseBlocks(text: string): Record<string, string> {
  // 按##分割文本
  const blocks = text.split('##');
  const blockDict: Record<string, string> = {};
  
  // 遍历所有块
  for (const block of blocks) {
    // 如果块不为空，则继续处理
    if (block.trim() !== '') {
      // 将块的标题和内容分开
      const parts = block.split('\n', 2);
      let blockTitle = parts[0].trim();
      let blockContent = '';
      
      // 如果块有内容
      if (parts.length > 1) {
        blockContent = parts.slice(1).join('\n').trim();
      }
      
      // LLM可能出错，修正标题末尾的冒号
      if (blockTitle.endsWith(':')) {
        blockTitle = blockTitle.slice(0, -1);
      }
      
      blockDict[blockTitle] = blockContent;
    }
  }
  
  return blockDict;
}

/**
 * 解析字符串列表，从文本中提取列表
 * @param text - 包含列表的文本
 * @returns 提取的字符串列表
 */
export function parseStringList(text: string): string[] {
  // 尝试匹配列表格式
  const listMatch = text.match(/\s*(.*=.*)?\s*(\[.*\])/s);
  if (listMatch) {
    try {
      // 使用JSON.parse解析列表字符串
      return JSON.parse(listMatch[2]);
    } catch (e) {
      // 如果解析失败，按行分割
      return text.split('\n').filter(line => line.trim() !== '');
    }
  }
  
  // 如果没有匹配到列表格式，按行分割
  return text.split('\n').filter(line => line.trim() !== '');
}

/**
 * 从文本中提取结构化数据（列表或字典）
 * @param text - 包含结构化数据的文本
 * @param dataType - 要提取的数据类型，可以是'array'或'object'
 * @returns 提取的结构化数据
 */
export function extractStruct<T>(text: string, dataType?: 'array' | 'object'): T {
  // 如果文本为空，返回空数组或空对象
  if (!text || !text.trim()) {
    return (dataType === 'array' ? [] : {}) as T;
  }
  
  text = text.trim();
  
  // 如果未指定数据类型，自动检测
  if (!dataType) {
    if (text.includes('[') && text.includes(']')) {
      dataType = 'array';
    } else if (text.includes('{') && text.includes('}')) {
      dataType = 'object';
    } else {
      return {} as T; // 默认返回空对象
    }
  }
  
  // 查找结构边界
  const startChar = dataType === 'array' ? '[' : '{';
  const endChar = dataType === 'array' ? ']' : '}';
  
  try {
    // 查找最外层结构
    const stack: string[] = [];
    let startIndex = -1;
    let endIndex = -1;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === startChar) {
        if (stack.length === 0) { // 第一个开始括号
          startIndex = i;
        }
        stack.push(char);
      } else if (char === endChar) {
        if (stack.length > 0 && stack[stack.length - 1] === startChar) {
          stack.pop();
          if (stack.length === 0) { // 找到匹配的括号对
            endIndex = i;
            break;
          }
        }
      }
    }
    
    if (startIndex !== -1 && endIndex !== -1) {
      // 提取结构部分
      const structText = text.substring(startIndex, endIndex + 1);
      
      try {
        // 尝试解析
        return JSON.parse(structText) as T;
      } catch (e) {
        // 如果解析失败，尝试清理后再解析
        const cleanedText = cleanJsonString(structText);
        return JSON.parse(cleanedText) as T;
      }
    }
  } catch (e) {
    console.error('提取结构时出错:', e);
  }
  
  // 如果所有解析尝试都失败，返回空结构
  return (dataType === 'array' ? [] : {}) as T;
}

/**
 * Truncate a string to a maximum length
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength) + '...';
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param initialDelay - Initial delay in milliseconds
 * @returns Promise that resolves with the function result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = initialDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * 从文本中提取特定标签之间的内容
 * @param text - 要处理的文本
 * @param tag - 标签名称，默认为"CONTENT"
 * @returns 提取的内容
 */
export function extractContent(text: string, tag: string = 'CONTENT'): string {
  const regex = new RegExp(`\\[${tag}\\](.*?)\\[\\/${tag}\\]`, 's');
  const match = regex.exec(text);
  
  if (match) {
    return match[1].trim();
  } else {
    throw new Error(`无法找到[${tag}]和[/${tag}]之间的内容`);
  }
}

/**
 * 解析数据并应用映射
 * @param data - 要解析的数据
 * @param mapping - 类型映射
 * @returns 解析后的数据
 */
export function parseDataWithMapping(data: string, mapping: Record<string, any>): Record<string, any> {
  // 如果数据包含[CONTENT]标签，提取内容
  if (data.includes('[CONTENT]')) {
    data = extractContent(data);
  }
  
  // 解析块
  const blockDict = parseBlocks(data);
  const parsedData: Record<string, any> = {};
  
  // 处理每个块
  for (const [block, content] of Object.entries(blockDict)) {
    let processedContent: any = content;
    
    // 尝试去除代码标记
    try {
      processedContent = parseCodeBlock(content);
    } catch (e) {
      // 解析代码失败，继续处理
    }
    
    // 获取映射中定义的类型
    const typingDefine = mapping[block];
    let typing = typingDefine;
    
    if (Array.isArray(typingDefine)) {
      typing = typingDefine[0];
    }
    
    // 根据类型处理内容
    if (typing === 'Array<string>' || typing === 'Array<[string, string]>' || typing === 'Array<Array<string>>') {
      // 尝试解析列表
      try {
        processedContent = parseStringList(processedContent);
      } catch (e) {
        // 解析列表失败，继续处理
      }
    }
    
    parsedData[block] = processedContent;
  }
  
  return parsedData;
}

/**
 * 使用Zod模式验证解析JSON
 * @param text - 要解析的文本
 * @param schema - Zod模式对象
 * @param defaultValue - 解析失败时返回的默认值，如果未提供则抛出错误
 * @returns 解析并验证后的对象
 */
export function parseJsonWithZod<T>(
  text: string, 
  schema: z.ZodType<T>, 
  defaultValue?: T
): T {
  try {
    // 首先尝试解析JSON
    const parsedData = parseJson<unknown>(text);
    
    // 然后使用Zod验证解析后的数据
    const validatedData = schema.parse(parsedData);
    return validatedData;
  } catch (error) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    // 如果没有提供默认值，则抛出错误
    if (error instanceof z.ZodError) {
      throw new Error(`数据验证失败: ${error.message}`);
    } else {
      throw new Error(`JSON解析失败: ${(error as Error).message}`);
    }
  }
}

/**
 * 使用Zod模式验证解析JSON，返回验证结果
 * @param text - 要解析的文本
 * @param schema - Zod模式对象
 * @returns 包含验证结果的对象，success为true表示验证成功，data包含验证后的数据；success为false表示验证失败，error包含错误信息
 */
export function safeParseJsonWithZod<T>(
  text: string, 
  schema: z.ZodType<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    // 首先尝试解析JSON
    const parsedData = parseJson<unknown>(text);
    
    // 然后使用Zod验证解析后的数据
    const result = schema.safeParse(parsedData);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error.message };
    }
  } catch (error) {
    return { 
      success: false, 
      error: `JSON解析失败: ${(error as Error).message}` 
    };
  }
}

/**
 * 从文本中提取并验证JSON对象
 * @param text - 包含JSON的文本
 * @param schema - Zod模式对象
 * @returns 提取并验证后的对象
 */
export function extractAndValidateJson<T>(
  text: string, 
  schema: z.ZodType<T>
): T {
  // 首先尝试提取JSON
  const extractedJson = extractJsonFromText(text);
  
  if (!extractedJson) {
    throw new Error('无法从文本中提取JSON');
  }
  
  try {
    // 解析JSON
    const parsedData = JSON.parse(extractedJson) as unknown;
    
    // 使用Zod验证
    return schema.parse(parsedData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`数据验证失败: ${error.message}`);
    } else {
      throw new Error(`JSON解析失败: ${(error as Error).message}`);
    }
  }
}

/**
 * 解析代码块中的JSON并验证
 * @param text - 包含代码块的文本
 * @param schema - Zod模式对象
 * @param lang - 代码块的语言标识，默认为'json'
 * @returns 解析并验证后的对象
 */
export function parseCodeBlockJsonWithZod<T>(
  text: string, 
  schema: z.ZodType<T>, 
  lang: string = 'json'
): T {
  // 提取代码块
  const codeContent = parseCodeBlock(text, lang);
  
  try {
    // 解析JSON
    const parsedData = JSON.parse(codeContent) as unknown;
    
    // 使用Zod验证
    return schema.parse(parsedData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`数据验证失败: ${error.message}`);
    } else {
      // 如果直接解析失败，尝试清理后再解析
      try {
        const cleanedText = cleanJsonString(codeContent);
        const parsedData = JSON.parse(cleanedText) as unknown;
        return schema.parse(parsedData);
      } catch (innerError) {
        if (innerError instanceof z.ZodError) {
          throw new Error(`数据验证失败: ${innerError.message}`);
        } else {
          throw new Error(`JSON解析失败: ${(innerError as Error).message}`);
        }
      }
    }
  }
} 