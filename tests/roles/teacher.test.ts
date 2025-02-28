import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Teacher } from '../../src/roles/teacher';
import { createTestLLMProvider } from '../utils/test-llm-provider';
import type { LLMProvider } from '../../src/types/llm';
import { UserMessage } from '../../src/types/message';

describe('Teacher', () => {
  let llmProvider: LLMProvider;
  
  beforeEach(() => {
    llmProvider = createTestLLMProvider();
  });

  it('should initialize correctly', () => {
    const teacher = new Teacher('test_teacher', llmProvider);
    
    expect(teacher.name).toBe('test_teacher');
    expect(teacher.llm).toBe(llmProvider);
  });

  it('should create lesson plan', async () => {
    const teacher = new Teacher('test_teacher', llmProvider);
    const topic = 'Introduction to TypeScript';

    const result = await teacher.createLessonPlan(topic);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.status).toBe('completed');
  });

  it('should handle empty topic', async () => {
    const teacher = new Teacher('test_teacher', llmProvider);
    
    const result = await teacher.createLessonPlan('');
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Empty topic');
  });

  it('should generate quiz questions', async () => {
    const teacher = new Teacher('test_teacher', llmProvider);
    const topic = 'TypeScript Basics';

    const result = await teacher.generateQuiz(topic);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.status).toBe('completed');
  });

  it('should evaluate student answer', async () => {
    const teacher = new Teacher('test_teacher', llmProvider);
    const question = 'What is TypeScript?';
    const answer = 'TypeScript is a strongly typed programming language that builds on JavaScript.';

    const result = await teacher.evaluateAnswer(question, answer);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.status).toBe('completed');
  });

  it('should create a Teacher instance with correct default values', () => {
    const teacher = new Teacher('test_teacher', llmProvider);
    expect(teacher.name).toBe('test_teacher');
    expect(teacher.profile).toBe('Educational Expert');
    expect(teacher.getTeachingStyle()).toBe('adaptive');
    expect(teacher.getSubjectExpertise()).toEqual(['mathematics', 'physics']);
  });

  it('should create a Teacher instance with custom configuration', () => {
    const customTeacher = new Teacher('test_teacher', llmProvider, {
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
    const teacher = new Teacher('test_teacher', llmProvider);
    teacher.addSubjectExpertise('chemistry');
    expect(teacher.getSubjectExpertise()).toContain('chemistry');
    
    // Adding duplicate subject should not create duplicates
    teacher.addSubjectExpertise('chemistry');
    expect(teacher.getSubjectExpertise().filter(s => s === 'chemistry')).toHaveLength(1);
  });

  it('should correctly check difficulty level handling', () => {
    const teacher = new Teacher('test_teacher', llmProvider);
    expect(teacher.canHandleDifficultyLevel('beginner')).toBe(true);
    expect(teacher.canHandleDifficultyLevel('intermediate')).toBe(true);
    expect(teacher.canHandleDifficultyLevel('advanced')).toBe(false);
  });

  it('should allow changing teaching style', () => {
    const teacher = new Teacher('test_teacher', llmProvider);
    teacher.setTeachingStyle('direct');
    expect(teacher.getTeachingStyle()).toBe('direct');

    teacher.setTeachingStyle('socratic');
    expect(teacher.getTeachingStyle()).toBe('socratic');
  });

  it('should perform thinking process with messages in memory', async () => {
    const teacher = new Teacher('test_teacher', llmProvider);
    // Add a message to the teacher's memory
    const message = new UserMessage('What is the Pythagorean theorem?');
    teacher.context.memory.add(message);

    const result = await teacher.think();
    expect(result).toBe(true);
  });

  it('should handle thinking process with empty memory', async () => {
    const teacher = new Teacher('test_teacher', llmProvider);
    const result = await teacher.think();
    expect(result).toBe(false);
  });
}); 