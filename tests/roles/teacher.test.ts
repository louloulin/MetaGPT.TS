import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Teacher } from '../../src/roles/teacher';
import type { LLMProvider } from '../../src/types/llm';
import { UserMessage } from '../../src/types/message';

describe('Teacher Role', () => {
  let mockLLM: LLMProvider;
  let teacher: Teacher;

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

    // Create teacher instance with default configuration
    teacher = new Teacher({
      llm: mockLLM,
      teachingStyle: 'adaptive',
      subjectExpertise: ['mathematics', 'physics'],
      difficultyLevels: ['beginner', 'intermediate']
    });
  });

  it('should create a Teacher instance with correct default values', () => {
    expect(teacher).toBeInstanceOf(Teacher);
    expect(teacher.name).toBe('Teacher');
    expect(teacher.profile).toBe('Educational Expert');
    expect(teacher.getTeachingStyle()).toBe('adaptive');
    expect(teacher.getSubjectExpertise()).toEqual(['mathematics', 'physics']);
  });

  it('should create a Teacher instance with custom configuration', () => {
    const customTeacher = new Teacher({
      llm: mockLLM,
      name: 'Math Teacher',
      profile: 'Mathematics Expert',
      goal: 'Teach advanced mathematics',
      constraints: 'Focus on practical applications',
      teachingStyle: 'socratic',
      subjectExpertise: ['mathematics'],
      difficultyLevels: ['advanced']
    });

    expect(customTeacher.name).toBe('Math Teacher');
    expect(customTeacher.profile).toBe('Mathematics Expert');
    expect(customTeacher.goal).toBe('Teach advanced mathematics');
    expect(customTeacher.constraints).toBe('Focus on practical applications');
    expect(customTeacher.getTeachingStyle()).toBe('socratic');
    expect(customTeacher.getSubjectExpertise()).toEqual(['mathematics']);
  });

  it('should allow adding new subject expertise', () => {
    teacher.addSubjectExpertise('chemistry');
    expect(teacher.getSubjectExpertise()).toContain('chemistry');
    
    // Adding duplicate subject should not create duplicates
    teacher.addSubjectExpertise('chemistry');
    expect(teacher.getSubjectExpertise().filter(s => s === 'chemistry')).toHaveLength(1);
  });

  it('should correctly check difficulty level handling', () => {
    expect(teacher.canHandleDifficultyLevel('beginner')).toBe(true);
    expect(teacher.canHandleDifficultyLevel('intermediate')).toBe(true);
    expect(teacher.canHandleDifficultyLevel('advanced')).toBe(false);
  });

  it('should allow changing teaching style', () => {
    teacher.setTeachingStyle('direct');
    expect(teacher.getTeachingStyle()).toBe('direct');

    teacher.setTeachingStyle('socratic');
    expect(teacher.getTeachingStyle()).toBe('socratic');
  });

  it('should perform thinking process with messages in memory', async () => {
    // Add a message to the teacher's memory
    const message = new UserMessage('What is the Pythagorean theorem?');
    teacher.context.memory.add(message);

    const result = await teacher.think();
    expect(result).toBe(true);
  });

  it('should handle thinking process with empty memory', async () => {
    const result = await teacher.think();
    expect(result).toBe(false);
  });
}); 