import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Assistant } from '../../src/roles/assistant';
import type { LLMProvider } from '../../src/types/llm';
import { UserMessage } from '../../src/types/message';

describe('Assistant Role', () => {
  let mockLLM: LLMProvider;
  let assistant: Assistant;

  beforeEach(() => {
    // Create mock LLM provider
    mockLLM = {
      chat: vi.fn().mockResolvedValue('Mock chat response'),
      getName: vi.fn().mockReturnValue('MockLLM'),
      getModel: vi.fn().mockReturnValue('mock-model-v1'),
      generate: vi.fn().mockResolvedValue('Mock generation'),
      setSystemPrompt: vi.fn(),
      getSystemPrompt: vi.fn().mockReturnValue('Mock system prompt'),
      chatStream: vi.fn(),
      generateStream: vi.fn(),
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
    };

    // Create assistant instance with default configuration
    assistant = new Assistant({
      llm: mockLLM,
      capabilities: ['general_assistance', 'task_management'],
      specialties: ['general', 'organization'],
      memory_limit: 50
    });
  });

  it('should create an Assistant instance with correct default values', () => {
    expect(assistant).toBeInstanceOf(Assistant);
    expect(assistant.name).toBe('Assistant');
    expect(assistant.profile).toBe('General Assistant');
    expect(assistant.getCapabilities()).toEqual(['general_assistance', 'task_management']);
    expect(assistant.getSpecialties()).toEqual(['general', 'organization']);
    expect(assistant.getMemoryLimit()).toBe(50);
  });

  it('should create an Assistant instance with custom configuration', () => {
    const customAssistant = new Assistant({
      llm: mockLLM,
      name: 'Custom Assistant',
      profile: 'Specialized Helper',
      goal: 'Provide specialized assistance',
      constraints: 'Focus on specific tasks',
      capabilities: ['specialized_task'],
      specialties: ['specific_domain'],
      memory_limit: 25
    });

    expect(customAssistant.name).toBe('Custom Assistant');
    expect(customAssistant.profile).toBe('Specialized Helper');
    expect(customAssistant.goal).toBe('Provide specialized assistance');
    expect(customAssistant.constraints).toBe('Focus on specific tasks');
    expect(customAssistant.getCapabilities()).toEqual(['specialized_task']);
    expect(customAssistant.getSpecialties()).toEqual(['specific_domain']);
    expect(customAssistant.getMemoryLimit()).toBe(25);
  });

  it('should allow adding new capabilities', () => {
    assistant.addCapability('new_capability');
    expect(assistant.getCapabilities()).toContain('new_capability');
    
    // Adding duplicate capability should not create duplicates
    assistant.addCapability('new_capability');
    expect(assistant.getCapabilities().filter(c => c === 'new_capability')).toHaveLength(1);
  });

  it('should allow adding new specialties', () => {
    assistant.addSpecialty('new_specialty');
    expect(assistant.getSpecialties()).toContain('new_specialty');
    
    // Adding duplicate specialty should not create duplicates
    assistant.addSpecialty('new_specialty');
    expect(assistant.getSpecialties().filter(s => s === 'new_specialty')).toHaveLength(1);
  });

  it('should correctly check capability existence', () => {
    expect(assistant.hasCapability('general_assistance')).toBe(true);
    expect(assistant.hasCapability('task_management')).toBe(true);
    expect(assistant.hasCapability('nonexistent_capability')).toBe(false);
  });

  it('should allow updating memory limit', () => {
    assistant.setMemoryLimit(75);
    expect(assistant.getMemoryLimit()).toBe(75);
  });

  it('should perform thinking process with messages in memory', async () => {
    // Add a message to the assistant's memory
    const message = new UserMessage('Can you help me organize my tasks?');
    assistant.context.memory.add(message);

    const result = await assistant.think();
    expect(result).toBe(true);
  });

  it('should handle thinking process with empty memory', async () => {
    const result = await assistant.think();
    expect(result).toBe(false);
  });

  it('should manage memory within limits', () => {
    // Add messages up to the limit
    const memoryLimit = assistant.getMemoryLimit();
    for (let i = 0; i < memoryLimit + 10; i++) {
      assistant.context.memory.add(new UserMessage(`Message ${i}`));
    }

    // Private method test through behavior observation
    const messages = assistant.context.memory.get();
    expect(messages.length).toBeLessThanOrEqual(memoryLimit);
    expect(messages[messages.length - 1].content).toBe(`Message ${memoryLimit + 9}`);
  });
}); 