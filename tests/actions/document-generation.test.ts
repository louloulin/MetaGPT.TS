/**
 * Unit tests for DocumentGeneration action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentGeneration, DocumentType, DocumentFormat } from '../../src/actions/document-generation';
import type { DocumentGenerationResult, DocumentGenerationConfig } from '../../src/actions/document-generation';
import { DocumentStatus } from '../../src/types/document';

// Mock LLM provider
const mockLLM = {
  chat: vi.fn(),
  getName: () => 'MockLLM',
  getModel: () => 'test-model',
  generate: vi.fn(),
  ask: vi.fn().mockImplementation(async (prompt: string) => {
    // Mock response for API documentation
    if (prompt.includes('API_DOCUMENTATION') || prompt.includes('API Documentation')) {
      return JSON.stringify({
        title: "User API Documentation",
        content: "# User API Documentation\n\n## Introduction\nThis API documentation describes the User endpoints...\n\n## Authentication\nAll API requests require authentication...\n\n## Endpoints\n### GET /users\nReturns a list of users...\n\n### POST /users\nCreates a new user...\n\n## Request/Response Examples\n```json\n// Request\nPOST /users\n{\n  \"name\": \"Jane Doe\",\n  \"email\": \"jane@example.com\"\n}\n\n// Response\n{\n  \"id\": \"123\",\n  \"name\": \"Jane Doe\",\n  \"email\": \"jane@example.com\"\n}\n```\n\n## Error Handling\nErrors are returned as JSON objects...\n\n## Rate Limiting\nThe API is limited to 100 requests per minute...\n\n## Versioning\nThe current version is v1...\n\n## SDK Examples\n```javascript\nconst client = new APIClient();\nconst users = await client.getUsers();\n```\n\n## FAQ\n**Q: How do I reset my API key?**\nA: Contact support...",
        sections: {
          "Introduction": "This API documentation describes the User endpoints available in the system. Use these endpoints to manage user data.",
          "Authentication": "All API requests require authentication using an API key. Include your API key in the header as 'Authorization: Bearer YOUR_API_KEY'.",
          "Endpoints": "### GET /users\nReturns a list of users with pagination support.\n\n### POST /users\nCreates a new user with the provided data.\n\n### GET /users/{id}\nReturns a specific user by ID.\n\n### PUT /users/{id}\nUpdates a user's information.\n\n### DELETE /users/{id}\nDeletes a user.",
          "Request/Response Examples": "```json\n// Request\nPOST /users\n{\n  \"name\": \"Jane Doe\",\n  \"email\": \"jane@example.com\"\n}\n\n// Response\n{\n  \"id\": \"123\",\n  \"name\": \"Jane Doe\",\n  \"email\": \"jane@example.com\"\n}\n```",
          "Error Handling": "Errors are returned as JSON objects with an error code and message. Example: `{\"error\": \"not_found\", \"message\": \"User not found\"}`",
          "Rate Limiting": "The API is limited to 100 requests per minute per API key. Rate limit information is included in the response headers.",
          "Versioning": "The current version is v1. The version is specified in the URL path: `/api/v1/users`",
          "SDK Examples": "```javascript\nconst client = new APIClient();\nconst users = await client.getUsers();\n```",
          "FAQ": "**Q: How do I reset my API key?**\nA: Contact support to reset your API key.\n\n**Q: Are there any usage quotas?**\nA: Free tier has a limit of 1000 requests per day."
        },
        toc: [
          "Introduction",
          "Authentication",
          "Endpoints",
          "Request/Response Examples",
          "Error Handling",
          "Rate Limiting",
          "Versioning",
          "SDK Examples",
          "FAQ"
        ],
        keywords: ["API", "REST", "endpoints", "users", "authentication", "versioning", "rate limiting"],
        references: [
          "OpenAPI Specification",
          "RESTful API Design Best Practices",
          "API Security Guidelines"
        ]
      });
    } 
    // Mock response for user guide
    else if (prompt.includes('USER_GUIDE') || prompt.includes('User Guide')) {
      return JSON.stringify({
        title: "Task Manager - User Guide",
        content: "# Task Manager - User Guide\n\n## Introduction\nTask Manager is a simple application for managing your tasks...\n\n## Getting Started\nTo get started with Task Manager, download the application from...\n\n## Installation\nFollow these steps to install Task Manager...\n\n## Basic Usage\nCreate your first task by clicking the '+' button...\n\n## Advanced Features\nTask Manager includes several advanced features such as recurring tasks...\n\n## Troubleshooting\nIf you encounter any issues, try the following troubleshooting steps...\n\n## FAQ\n**Q: Can I export my tasks?**\nA: Yes, you can export your tasks to CSV by going to Settings > Export.\n\n## Glossary\n**Task**: A single item of work...\n**Project**: A collection of related tasks...",
        sections: {
          "Introduction": "Task Manager is a simple application for managing your tasks and projects. It helps you stay organized by tracking deadlines, priorities, and completion status.",
          "Getting Started": "To get started with Task Manager, download the application from our website or install it from your platform's app store. Create an account using your email address or sign in with Google or Apple accounts.",
          "Installation": "### Windows\n1. Download the installer from our website\n2. Run the installer and follow the prompts\n3. Launch Task Manager from the Start menu\n\n### macOS\n1. Download the .dmg file\n2. Open the file and drag Task Manager to your Applications folder\n3. Launch Task Manager from Applications",
          "Basic Usage": "Create your first task by clicking the '+' button in the bottom right corner. Enter a task name, optional description, due date, and priority. Tasks will appear in your inbox by default, or you can assign them to a specific project.",
          "Advanced Features": "Task Manager includes several advanced features:\n- Recurring tasks: Set tasks to repeat daily, weekly, monthly, or on custom schedules\n- Time tracking: Track how long you spend on each task\n- Task dependencies: Set up tasks that require other tasks to be completed first\n- Collaboration: Share projects with team members and assign tasks to others",
          "Troubleshooting": "If you encounter any issues, try the following troubleshooting steps:\n1. Restart the application\n2. Check your internet connection\n3. Clear the application cache (Settings > Advanced > Clear Cache)\n4. Ensure you have the latest version installed\n\nIf problems persist, contact our support team at support@taskmanager.example.com",
          "FAQ": "**Q: Can I export my tasks?**\nA: Yes, you can export your tasks to CSV by going to Settings > Export.\n\n**Q: Is my data backed up?**\nA: Yes, your data is automatically backed up to our secure cloud servers.\n\n**Q: Can I use Task Manager offline?**\nA: Yes, Task Manager works offline and will sync your changes when you reconnect.",
          "Glossary": "**Task**: A single item of work that needs to be completed\n**Project**: A collection of related tasks\n**Tag**: A label used to categorize and filter tasks\n**Priority**: The importance level of a task (Low, Medium, High, Urgent)\n**Due Date**: The date by which a task should be completed"
        },
        toc: [
          "Introduction",
          "Getting Started",
          "Installation",
          "Basic Usage",
          "Advanced Features",
          "Troubleshooting",
          "FAQ",
          "Glossary"
        ],
        keywords: ["task manager", "to-do", "productivity", "task tracking", "project management", "collaboration"],
        references: [
          "Task Manager Website",
          "Online Help Center",
          "Video Tutorials"
        ]
      });
    }
    // Mock response for invalid JSON
    else if (prompt.includes('invalid json')) {
      return 'This is not valid JSON';
    }
    // Default fallback response
    else {
      return JSON.stringify({
        title: "Generated Document",
        content: "# Generated Document\n\n## Introduction\nThis is a generated document based on the provided configuration.\n\n## Main Content\nAdd your main content here.\n\n## Conclusion\nSummarize your document here.\n\n## References\n- Reference 1\n- Reference 2",
        sections: {
          "Introduction": "This is a generated document based on the provided configuration.",
          "Main Content": "Add your main content here.",
          "Conclusion": "Summarize your document here.",
          "References": "- Reference 1\n- Reference 2"
        },
        toc: [
          "Introduction",
          "Main Content",
          "Conclusion",
          "References"
        ],
        keywords: ["document", "generated", "template"],
        references: [
          "Reference 1",
          "Reference 2"
        ]
      });
    }
  })
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
    });
    
    // Setup the ask method from BaseAction
    (documentGeneration as any).ask = mockLLM.ask;
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
        title: 'Test Document'
      }
    });
    
    // Setup the ask method
    (docGen as any).ask = mockLLM.ask;
    
    // Execute the action
    const result = await docGen.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No document type provided');
  });
  
  it('should generate API documentation', async () => {
    // Create DocumentGeneration instance for API documentation
    const apiDocGen = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        title: 'User API Documentation',
        type: DocumentType.API_DOCUMENTATION,
        format: DocumentFormat.MARKDOWN
      }
    });
    
    // Setup the ask method
    (apiDocGen as any).ask = mockLLM.ask;
    
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
  
  it('should generate a user guide', async () => {
    // Create DocumentGeneration instance for a user guide
    const userGuideGen = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        title: 'Task Manager - User Guide',
        type: DocumentType.USER_GUIDE,
        format: DocumentFormat.MARKDOWN,
        target_audience: 'End users with basic computer literacy'
      }
    });
    
    // Setup the ask method
    (userGuideGen as any).ask = mockLLM.ask;
    
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
  
  it('should include document metadata in the prompt', async () => {
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
        }
      }
    });
    
    // Setup the ask method
    (docGenWithMeta as any).ask = mockLLM.ask;
    
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
  
  it('should handle LLM response parsing errors gracefully', async () => {
    // Create DocumentGeneration instance with input that will trigger invalid JSON
    const invalidJsonDoc = new DocumentGeneration({
      name: 'DocumentGeneration',
      llm: mockLLM,
      args: {
        title: 'Invalid JSON Document',
        type: DocumentType.README,
        format: DocumentFormat.MARKDOWN
      }
    });
    
    // Setup the ask method to return invalid JSON
    (invalidJsonDoc as any).ask = async () => 'This is not valid JSON';
    
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
  
  it('should format document based on requested format', async () => {
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
    
    // Setup the ask method
    (htmlDocGen as any).ask = mockLLM.ask;
    
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
  
  it('should include template sections in the prompt when specified', async () => {
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
    
    // Setup the ask method
    (docGenWithTemplates as any).ask = mockLLM.ask;
    
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