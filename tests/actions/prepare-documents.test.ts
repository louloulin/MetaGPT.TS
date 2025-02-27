/**
 * Unit tests for PrepareDocuments action
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrepareDocuments, REQUIREMENT_FILENAME } from '../../src/actions/prepare-documents';
import { MockLLM } from '../mocks/mock-llm';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ConfigManager } from '../../src/config/config';

describe('PrepareDocuments', () => {
  // Create a temporary test directory
  const testDir = path.join(os.tmpdir(), `metagpt-test-${Date.now()}`);
  let mockLLM: MockLLM;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a new mock LLM for each test
    mockLLM = new MockLLM({
      responses: {
        default: 'Mock LLM response',
      }
    });
    
    // Mock ConfigManager.getInstance
    vi.spyOn(ConfigManager, 'getInstance').mockReturnValue({
      getConfig: () => ({
        workspace: {
          storagePath: testDir,
          autoClean: false,
          root: testDir
        },
        projectName: 'test-project'
      })
    } as any);
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
    
    vi.restoreAllMocks();
  });

  it('should initialize with correct properties', () => {
    const prepareDocuments = new PrepareDocuments({
      name: 'PrepareDocuments',
      description: 'Initialize project folder',
      llm: mockLLM,
      projectPath: path.join(testDir, 'custom-project')
    });
    
    expect(prepareDocuments).toBeInstanceOf(PrepareDocuments);
    expect(prepareDocuments['name']).toBe('PrepareDocuments');
    expect(prepareDocuments['llm']).toBe(mockLLM);
    expect(prepareDocuments['config'].projectPath).toBe(path.join(testDir, 'custom-project'));
  });

  it('should create project directory and requirements file', async () => {
    const projectPath = path.join(testDir, 'new-project');
    const prepareDocuments = new PrepareDocuments({
      name: 'PrepareDocuments',
      description: 'Initialize project folder',
      llm: mockLLM,
      projectPath: projectPath,
      args: {
        content: 'Test requirements content'
      }
    });
    
    const result = await prepareDocuments.run();
    
    // Verify action completed successfully
    expect(result.status).toBe('completed');
    
    // Verify project directory was created
    const dirExists = await fs.stat(projectPath).then(() => true).catch(() => false);
    expect(dirExists).toBe(true);
    
    // Verify requirements file was created with correct content
    const requirementsPath = path.join(projectPath, REQUIREMENT_FILENAME);
    const requirementsContent = await fs.readFile(requirementsPath, 'utf-8');
    expect(requirementsContent).toBe('Test requirements content');
    
    // Verify returned document has correct properties
    expect(result.instructContent).toBeDefined();
    expect(result.instructContent.content).toBe('Test requirements content');
    expect(result.instructContent.path).toBe(requirementsPath);
    expect(result.instructContent.name).toBe(REQUIREMENT_FILENAME);
  });

  it('should use incremental mode when specified', async () => {
    // First create a project with initial content
    const projectPath = path.join(testDir, 'incremental-project');
    await fs.mkdir(projectPath, { recursive: true });
    
    // Create a marker file to check if the directory is preserved
    const markerPath = path.join(projectPath, 'marker.txt');
    await fs.writeFile(markerPath, 'This file should be preserved in incremental mode');
    
    // Create the requirements dir
    await fs.mkdir(path.join(projectPath, 'docs'), { recursive: true });
    
    // Now run the action with incremental mode
    const prepareDocuments = new PrepareDocuments({
      name: 'PrepareDocuments',
      description: 'Initialize project folder',
      llm: mockLLM,
      projectPath: projectPath,
      incremental: true,
      args: {
        content: 'Updated requirements content'
      }
    });
    
    const result = await prepareDocuments.run();
    
    // Verify action completed successfully
    expect(result.status).toBe('completed');
    
    // Verify marker file still exists (directory was not deleted)
    const markerExists = await fs.stat(markerPath).then(() => true).catch(() => false);
    expect(markerExists).toBe(true);
    
    // Verify requirements file was created/updated with new content
    const requirementsPath = path.join(projectPath, REQUIREMENT_FILENAME);
    const requirementsContent = await fs.readFile(requirementsPath, 'utf-8');
    expect(requirementsContent).toBe('Updated requirements content');
  });

  it('should delete existing directory when not in incremental mode', async () => {
    // First create a project with initial content
    const projectPath = path.join(testDir, 'non-incremental-project');
    await fs.mkdir(projectPath, { recursive: true });
    
    // Create a marker file to check if the directory is deleted
    const markerPath = path.join(projectPath, 'marker.txt');
    await fs.writeFile(markerPath, 'This file should be deleted in non-incremental mode');
    
    // Now run the action without incremental mode
    const prepareDocuments = new PrepareDocuments({
      name: 'PrepareDocuments',
      description: 'Initialize project folder',
      llm: mockLLM,
      projectPath: projectPath,
      incremental: false, // Explicitly set to false
      args: {
        content: 'Fresh requirements content'
      }
    });
    
    const result = await prepareDocuments.run();
    
    // Verify action completed successfully
    expect(result.status).toBe('completed');
    
    // Verify marker file no longer exists (directory was deleted and recreated)
    const markerExists = await fs.stat(markerPath).then(() => true).catch(() => false);
    expect(markerExists).toBe(false);
    
    // Verify requirements file was created with new content
    const requirementsPath = path.join(projectPath, REQUIREMENT_FILENAME);
    const requirementsContent = await fs.readFile(requirementsPath, 'utf-8');
    expect(requirementsContent).toBe('Fresh requirements content');
  });

  it('should use project name from config when not explicitly provided', async () => {
    // Run the action without specifying project path or name
    const prepareDocuments = new PrepareDocuments({
      name: 'PrepareDocuments',
      description: 'Initialize project folder',
      llm: mockLLM,
      args: {
        content: 'Default project requirements'
      }
    });
    
    const result = await prepareDocuments.run();
    
    // Verify action completed successfully
    expect(result.status).toBe('completed');
    
    // Expected project path from mock config (testDir + 'test-project')
    const expectedProjectPath = path.join(testDir, 'test-project');
    
    // Verify requirements file was created in the expected location
    const requirementsPath = path.join(expectedProjectPath, REQUIREMENT_FILENAME);
    const fileExists = await fs.stat(requirementsPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('should handle empty requirements content gracefully', async () => {
    const projectPath = path.join(testDir, 'empty-requirements-project');
    const prepareDocuments = new PrepareDocuments({
      name: 'PrepareDocuments',
      description: 'Initialize project folder',
      llm: mockLLM,
      projectPath: projectPath,
      args: {
        content: '' // Empty content
      }
    });
    
    // Mock logger.warn to test warning message
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const result = await prepareDocuments.run();
    
    // Verify action completed successfully despite empty content
    expect(result.status).toBe('completed');
    
    // Verify warning was logged
    expect(warnSpy).toHaveBeenCalled();
    
    // Verify requirements file was created with empty content
    const requirementsPath = path.join(projectPath, REQUIREMENT_FILENAME);
    const requirementsContent = await fs.readFile(requirementsPath, 'utf-8');
    expect(requirementsContent).toBe('');
  });

  it('should handle file system errors correctly', async () => {
    // Mock fs.mkdir to throw an error
    vi.spyOn(fs, 'mkdir').mockRejectedValueOnce(new Error('Simulated filesystem error'));
    
    const prepareDocuments = new PrepareDocuments({
      name: 'PrepareDocuments',
      description: 'Initialize project folder',
      llm: mockLLM,
      projectPath: '/invalid/path', // This should trigger the mocked error
      args: {
        content: 'Test requirements'
      }
    });
    
    const result = await prepareDocuments.run();
    
    // Verify action failed with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('Failed to prepare documents');
    expect(result.content).toContain('Simulated filesystem error');
  });
}); 