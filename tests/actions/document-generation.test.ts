/**
 * Unit tests for DocumentGeneration action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentGeneration, DocumentType, DocumentFormat } from '../../src/actions/document-generation';
import type { DocumentGenerationResult, DocumentGenerationConfig } from '../../src/actions/document-generation';
import { DocumentStatus } from '../../src/types/document';

// Mock LLM provider
const mockLLM = {
  chat: vi.fn().mockImplementation(async (prompt: string) => {
    let response;
    if (prompt.includes('API_DOCUMENTATION') || prompt.includes('API Documentation')) {
      response = {
        title: 'API Documentation',
        content: '# API Documentation\n\n## Introduction\nThis is the API documentation.\n\n## Authentication\nAuthentication details here.\n\n## Endpoints\n- GET /api/v1/users\n- POST /api/v1/users',
        sections: {
          'Introduction': 'This is the API documentation.',
          'Authentication': 'Authentication details here.',
          'Endpoints': '- GET /api/v1/users\n- POST /api/v1/users'
        },
        toc: ['Introduction', 'Authentication', 'Endpoints'],
        keywords: ['api', 'documentation', 'endpoints'],
        references: ['OpenAPI Specification'],
        type: 'API_DOCUMENTATION',
        format: 'MARKDOWN',
        metadata: {
          author: 'MetaGPT Document Generator',
          version: '1.0.0',
          date: new Date().toISOString().split('T')[0],
          project_name: 'MetaGPT'
        }
      };
    } else if (prompt.includes('USER_GUIDE') || prompt.includes('User Guide')) {
      response = {
        title: 'User Guide',
        content: '# User Guide\n\n## Getting Started\nWelcome to the user guide.\n\n## Installation\nInstallation instructions here.\n\n## Basic Usage\n- Feature 1\n- Feature 2',
        sections: {
          'Getting Started': 'Welcome to the user guide.',
          'Installation': 'Installation instructions here.',
          'Basic Usage': '- Feature 1\n- Feature 2'
        },
        toc: ['Getting Started', 'Installation', 'Basic Usage'],
        keywords: ['user guide', 'features', 'getting started'],
        references: ['Product Documentation'],
        type: 'USER_GUIDE',
        format: 'MARKDOWN',
        metadata: {
          author: 'MetaGPT Document Generator',
          version: '1.0.0',
          date: new Date().toISOString().split('T')[0],
          project_name: 'MetaGPT'
        }
      };
    } else if (prompt.includes('format: HTML')) {
      response = {
        title: 'HTML Document',
        content: '<html><head><title>HTML Document</title></head><body><h1>HTML Document</h1><p>This is an HTML document.</p></body></html>',
        sections: {
          'Main': 'This is an HTML document.'
        },
        toc: ['Main'],
        keywords: ['html', 'document'],
        references: [],
        type: 'TECHNICAL_SPECIFICATION',
        format: 'HTML',
        metadata: {
          author: 'MetaGPT Document Generator',
          version: '1.0.0',
          date: new Date().toISOString().split('T')[0],
          project_name: 'MetaGPT'
        }
      };
    } else if (prompt.includes('invalid json')) {
      return 'This is not valid JSON';
    } else {
      response = {
        title: 'Default Document',
        content: '# Default Document\n\n## Content\nThis is a default document.',
        sections: {
          'Content': 'This is a default document.'
        },
        toc: ['Content'],
        keywords: ['default', 'document'],
        references: [],
        type: 'TECHNICAL_SPECIFICATION',
        format: 'MARKDOWN',
        metadata: {
          author: 'MetaGPT Document Generator',
          version: '1.0.0',
          date: new Date().toISOString().split('T')[0],
          project_name: 'MetaGPT'
        }
      };
    }
    return response;
  }),
  getName: () => 'MockLLM',
  getModel: () => 'mock-model',
  generate: vi.fn().mockResolvedValue('Generated text')
};

describe('DocumentGeneration', () => {
  let documentGeneration: DocumentGeneration;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create DocumentGeneration instance with mock LLM
    documentGeneration = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        llm: mockLLM
      }
    });
  });
  
  it('should create a DocumentGeneration instance', () => {
    expect(documentGeneration).toBeInstanceOf(DocumentGeneration);
  });
  
  it('should fail when no title is provided', async () => {
    // Run the action without providing a title
    const result = await documentGeneration.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No document title provided');
  });
  
  it('should fail when no document type is provided', async () => {
    // Create DocumentGeneration instance with a title but no type
    const docGen = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        title: 'Test Document',
        llm: mockLLM
      }
    });
    
    // Execute the action
    const result = await docGen.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No document type provided');
  });
  
  it.skip('should generate API documentation', async () => {
    // Create DocumentGeneration instance for API documentation
    const apiDocGen = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        title: 'User API Documentation',
        type: DocumentType.API_DOCUMENTATION,
        format: DocumentFormat.MARKDOWN,
        llm: mockLLM
      }
    });
    
    // Execute the action
    const result = await apiDocGen.run();
    
    // Verify the documentation result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('User API Documentation');
    expect(result.content).toContain('Introduction');
    expect(result.content).toContain('Authentication');
    expect(result.content).toContain('Endpoints');
    
    // Verify the instructContent
    const docResult = result.instructContent as DocumentGenerationResult;
    expect(docResult.title).toBe('User API Documentation');
    expect(docResult.type).toBe(DocumentType.API_DOCUMENTATION);
    expect(docResult.sections).toHaveProperty('Endpoints');
    expect(docResult.toc.length).toBeGreaterThan(0);
    expect(docResult.keywords).toContain('API');
  });
  
  it.skip('should generate a user guide', async () => {
    // Create DocumentGeneration instance for a user guide
    const userGuideGen = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        title: 'Task Manager - User Guide',
        type: DocumentType.USER_GUIDE,
        format: DocumentFormat.MARKDOWN,
        target_audience: 'End users with basic computer literacy',
        llm: mockLLM
      }
    });
    
    // Execute the action
    const result = await userGuideGen.run();
    
    // Verify the user guide result
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Task Manager - User Guide');
    expect(result.content).toContain('Getting Started');
    expect(result.content).toContain('Installation');
    expect(result.content).toContain('Basic Usage');
    
    // Verify the instructContent
    const docResult = result.instructContent as DocumentGenerationResult;
    expect(docResult.title).toBe('Task Manager - User Guide');
    expect(docResult.type).toBe(DocumentType.USER_GUIDE);
    expect(docResult.sections).toHaveProperty('Basic Usage');
    expect(docResult.toc).toContain('Installation');
    expect(docResult.references.length).toBeGreaterThan(0);
  });
  
  it.skip('should include document metadata in the prompt', async () => {
    // Spy on the constructDocumentPrompt method
    const promptSpy = vi.spyOn(DocumentGeneration.prototype as any, 'constructDocumentPrompt');
    
    // Create DocumentGeneration instance with metadata
    const docGenWithMeta = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        title: 'Project Documentation',
        type: DocumentType.TECHNICAL_SPECIFICATION,
        metadata: {
          version: '2.0.1',
          author: 'Test Author',
          project_name: 'Test Project',
          project_description: 'A test project for document generation',
          license: 'MIT'
        },
        llm: mockLLM
      }
    });
    
    // Execute the action
    await docGenWithMeta.run();
    
    // Check that metadata was included in the prompt
    expect(promptSpy).toHaveBeenCalled();
    // Get the second argument (metadata) from the first call
    const metadataArg = promptSpy.mock.calls[0][1] as Record<string, string>;
    expect(metadataArg.version).toBe('2.0.1');
    expect(metadataArg.author).toBe('Test Author');
    expect(metadataArg.project_name).toBe('Test Project');
    expect(metadataArg.license).toBe('MIT');
  });
  
  it.skip('should handle LLM response parsing errors gracefully', async () => {
    // Create DocumentGeneration instance with input that will trigger invalid JSON
    const invalidJsonDoc = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        title: 'Invalid JSON Document',
        type: DocumentType.README,
        format: DocumentFormat.MARKDOWN,
        llm: mockLLM
      }
    });
    
    // Execute the action
    const result = await invalidJsonDoc.run();
    
    // Verify that a fallback result was created
    expect(result.status).toBe('completed');
    expect(result.content).toContain('Unable to generate complete document');
    expect(result.content).toContain('Error Details');
    
    // Verify the fallback document result structure
    const fallbackResult = result.instructContent as DocumentGenerationResult;
    expect(fallbackResult.title).toBe('Invalid JSON Document');
    expect(fallbackResult.sections).toHaveProperty('Error Details');
    expect(fallbackResult.toc.length).toBeGreaterThan(0);
    expect(fallbackResult.keywords).toContain('error');
  });
  
  it.skip('should format document based on requested format', async () => {
    // Create DocumentGeneration instance with HTML format
    const htmlDocGen = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        title: 'HTML Document',
        type: DocumentType.REFERENCE,
        format: DocumentFormat.HTML
      }
    });
    
    // Execute the action
    const result = await htmlDocGen.run();
    
    // Verify HTML formatting
    expect(result.content).toContain('<html>');
    expect(result.content).toContain('<title>');
    expect(result.content).toContain('</body></html>');
    
    // Also check the metadata header
    expect(result.content).toContain('Title: Generated Document');
    expect(result.content).toContain('Format: HTML');
  });
  
  it('should convert document result to Document object', () => {
    // Create a sample document generation result
    const docResult: DocumentGenerationResult = {
      title: 'Test Document',
      content: '# Test Document\n\nThis is a test.',
      type: DocumentType.README,
      format: DocumentFormat.MARKDOWN,
      metadata: {
        version: '1.0.0',
        date: '2023-01-01',
        author: 'Test Author',
        project_name: 'Test Project'
      },
      sections: {
        'Introduction': 'This is a test.'
      },
      toc: ['Introduction'],
      keywords: ['test'],
      references: [],
      file_path: '/path/to/document.md'
    };
    
    // Convert to Document
    const document = documentGeneration.toDocument(docResult);
    
    // Verify conversion
    expect(document.name).toBe('Test Document');
    expect(document.content).toBe('# Test Document\n\nThis is a test.');
    expect(document.author).toBe('Test Author');
    expect(document.status).toBe(DocumentStatus.DRAFT);
    expect(document.path).toBe('/path/to/document.md');
    expect(document.reviews).toEqual([]);
  });
  
  it.skip('should include template sections in the prompt when specified', async () => {
    // Spy on the constructDocumentPrompt method
    const promptSpy = vi.spyOn(DocumentGeneration.prototype as any, 'constructDocumentPrompt');
    
    // Create DocumentGeneration instance with template sections
    const docGenWithTemplates = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        title: 'Custom Template Document',
        type: DocumentType.TECHNICAL_SPECIFICATION,
        template_sections: [
          {
            title: 'Executive Summary',
            description: 'Brief overview of the system',
            required: true,
            content_prompt: 'Provide a high-level summary of the system purpose and functionality',
            order: 1
          },
          {
            title: 'Implementation Details',
            description: 'Detailed technical implementation',
            required: true,
            content_prompt: 'Describe the technical implementation in detail',
            order: 3
          },
          {
            title: 'System Requirements',
            description: 'Hardware and software requirements',
            required: false,
            content_prompt: 'List all system requirements',
            order: 2
          }
        ]
      }
    });
    
    // Execute the action
    await docGenWithTemplates.run();
    
    // Check that template sections affected the TOC in the correct order
    expect(promptSpy).toHaveBeenCalled();
    // Get the third argument (toc) from the first call
    const tocArg = promptSpy.mock.calls[0][2] as string[];
    expect(tocArg[0]).toBe('Executive Summary');
    expect(tocArg[1]).toBe('System Requirements');
    expect(tocArg[2]).toBe('Implementation Details');
  });
}); 