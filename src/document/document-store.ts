/**
 * Document Storage System
 * 
 * Provides document loading, parsing, indexing, and retrieval capabilities.
 * Supports various document formats and metadata handling.
 * 
 * @module document/document-store
 * @category Core
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { Document, IndexableDocument } from '../types/document';
import { DocumentImpl, IndexableDocumentImpl } from '../types/document';
import { z } from 'zod';

/**
 * Document store configuration schema
 */
export const DocumentStoreConfigSchema = z.object({
  /** Base directory for document storage */
  basePath: z.string().default('./documents'),
  /** Enable document indexing */
  enableIndexing: z.boolean().default(true),
  /** Document parsing options */
  parsingOptions: z.object({
    /** Maximum size of documents to parse (in bytes) */
    maxSize: z.number().default(10 * 1024 * 1024), // 10MB
    /** Supported file extensions */
    supportedExtensions: z.array(z.string()).default(['.txt', '.md', '.json', '.csv', '.html']),
    /** Character encoding */
    encoding: z.string().default('utf-8'),
  }).default({}),
  /** Document indexing options */
  indexingOptions: z.object({
    /** Directory for index storage */
    indexDir: z.string().default('./indexes'),
    /** Chunk size for indexing */
    chunkSize: z.number().default(1000),
    /** Chunk overlap */
    chunkOverlap: z.number().default(200),
  }).default({}),
});

/**
 * Document store configuration type
 */
export type DocumentStoreConfig = z.infer<typeof DocumentStoreConfigSchema>;

/**
 * Result of document loading operations
 */
export interface DocumentLoadResult {
  /** Loaded document */
  document: Document;
  /** Success status */
  success: boolean;
  /** Error message if any */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Document transformation pipeline stage
 */
export interface DocumentTransformer {
  /**
   * Transform a document
   * @param document The document to transform
   * @returns The transformed document
   */
  transform(document: Document): Promise<Document>;
}

/**
 * Document store interface
 */
export interface DocumentStore {
  /**
   * Load a document from a file path
   * @param filePath Path to the document file
   * @param options Additional options
   * @returns Document load result
   */
  loadDocument(filePath: string, options?: Partial<DocumentStoreConfig>): Promise<DocumentLoadResult>;
  
  /**
   * Load documents from a directory
   * @param dirPath Directory path to load from
   * @param options Additional options
   * @returns Array of document load results
   */
  loadDocuments(dirPath: string, options?: Partial<DocumentStoreConfig>): Promise<DocumentLoadResult[]>;
  
  /**
   * Save a document to storage
   * @param document Document to save
   * @param filePath Optional path to save to (uses document.path if not provided)
   * @returns Success status
   */
  saveDocument(document: Document, filePath?: string): Promise<boolean>;
  
  /**
   * Parse document content
   * @param content Document content
   * @param type Content type or file extension
   * @returns Parsed document
   */
  parseDocument(content: string, type: string): Promise<Document>;
  
  /**
   * Create an indexable document from a regular document
   * @param document Source document
   * @param options Indexing options
   * @returns Indexable document
   */
  createIndexableDocument(document: Document, options?: Partial<DocumentStoreConfig['indexingOptions']>): Promise<IndexableDocument>;
  
  /**
   * Apply a transformation pipeline to a document
   * @param document Document to transform
   * @param transformers Array of transformers to apply
   * @returns Transformed document
   */
  transformDocument(document: Document, transformers: DocumentTransformer[]): Promise<Document>;
  
  /**
   * Get document by ID or path
   * @param idOrPath Document ID or file path
   * @returns Document if found, undefined otherwise
   */
  getDocument(idOrPath: string): Promise<Document | undefined>;
  
  /**
   * Search for documents matching the query
   * @param query Search query
   * @param options Search options
   * @returns Array of matching documents
   */
  searchDocuments(query: string, options?: { limit?: number, filters?: Record<string, any> }): Promise<Document[]>;
}

/**
 * Default document transformer implementations
 */
export class TextNormalizerTransformer implements DocumentTransformer {
  /**
   * Normalize text by removing extra whitespace, etc.
   * @param document Document to transform
   * @returns Transformed document
   */
  async transform(document: Document): Promise<Document> {
    const normalizedContent = document.content
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    const result = new DocumentImpl({
      ...document,
      content: normalizedContent,
    });
    
    return result;
  }
}

/**
 * Basic document store implementation
 */
export class BasicDocumentStore implements DocumentStore {
  private config: DocumentStoreConfig;
  private documents: Map<string, Document> = new Map();
  
  /**
   * Create a new document store
   * @param config Store configuration
   */
  constructor(config: Partial<DocumentStoreConfig> = {}) {
    this.config = DocumentStoreConfigSchema.parse(config);
  }
  
  /**
   * Load a document from a file path
   * @param filePath Path to the document file
   * @param options Additional options
   * @returns Document load result
   */
  async loadDocument(filePath: string, options?: Partial<DocumentStoreConfig>): Promise<DocumentLoadResult> {
    const mergedConfig = {
      ...this.config,
      ...options,
    };
    
    try {
      // Check if file exists and get stats
      const stats = await fs.stat(filePath);
      
      // Check if it's a file
      if (!stats.isFile()) {
        return {
          document: new DocumentImpl({ path: filePath }),
          success: false,
          error: 'Path does not point to a file',
        };
      }
      
      // Check file size
      if (stats.size > mergedConfig.parsingOptions.maxSize) {
        return {
          document: new DocumentImpl({ path: filePath }),
          success: false,
          error: `File size exceeds the maximum allowed size of ${mergedConfig.parsingOptions.maxSize} bytes`,
        };
      }
      
      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!mergedConfig.parsingOptions.supportedExtensions.includes(ext)) {
        return {
          document: new DocumentImpl({ path: filePath }),
          success: false,
          error: `Unsupported file extension: ${ext}`,
        };
      }
      
      // Load document using DocumentImpl.fromPath
      const document = await DocumentImpl.fromPath(filePath);
      
      // Store the document in memory
      this.documents.set(document.path || filePath, document);
      
      return {
        document,
        success: true,
        metadata: {
          size: stats.size,
          extension: ext,
          lastModified: stats.mtime.toISOString(),
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to load document from ${filePath}:`, error);
      return {
        document: new DocumentImpl({ path: filePath }),
        success: false,
        error: `Failed to load document: ${message}`,
      };
    }
  }
  
  /**
   * Load documents from a directory
   * @param dirPath Directory path to load from
   * @param options Additional options
   * @returns Array of document load results
   */
  async loadDocuments(dirPath: string, options?: Partial<DocumentStoreConfig>): Promise<DocumentLoadResult[]> {
    const results: DocumentLoadResult[] = [];
    
    try {
      // Check if directory exists
      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        return [{
          document: new DocumentImpl({ path: dirPath }),
          success: false,
          error: 'Path does not point to a directory'
        }];
      }

      // Read directory contents
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // Process each entry
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        try {
          if (entry.isDirectory()) {
            // Recursively load documents from subdirectory
            const subResults = await this.loadDocuments(fullPath, options);
            results.push(...subResults);
          } else {
            // Load individual document
            const result = await this.loadDocument(fullPath, options);
            results.push(result);
          }
        } catch (error) {
          console.error(`Error processing ${fullPath}:`, error);
          results.push({
            document: new DocumentImpl({ path: fullPath }),
            success: false,
            error: `Failed to process: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error(`Failed to load documents from directory ${dirPath}:`, error);
      return [{
        document: new DocumentImpl({ path: dirPath }),
        success: false,
        error: `Failed to load documents: ${error instanceof Error ? error.message : String(error)}`
      }];
    }
  }
  
  /**
   * Save a document to storage
   * @param document Document to save
   * @param filePath Optional path to save to (uses document.path if not provided)
   * @returns Success status
   */
  async saveDocument(document: Document, filePath?: string): Promise<boolean> {
    try {
      const targetPath = filePath || document.path;
      
      if (!targetPath) {
        throw new Error('Document path is not set and no target path provided');
      }
      
      // Ensure the directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      
      // Save the document
      await fs.writeFile(targetPath, document.content, 'utf-8');
      
      // Update the document in the store
      const updatedDocument = new DocumentImpl({
        ...document,
        path: targetPath,
      });
      
      this.documents.set(targetPath, updatedDocument);
      
      return true;
    } catch (error) {
      console.error('Failed to save document:', error);
      return false;
    }
  }
  
  /**
   * Parse document content
   * @param content Document content
   * @param type Content type or file extension
   * @returns Parsed document
   */
  async parseDocument(content: string, type: string): Promise<Document> {
    // Normalize the type
    const normalizedType = type.startsWith('.') ? type : `.${type}`;
    
    // Create a basic document
    let document = new DocumentImpl({
      content,
      name: `parsed-document-${Date.now()}${normalizedType}`,
    });
    
    // Apply type-specific parsing
    switch (normalizedType.toLowerCase()) {
      case '.json':
        try {
          const jsonData = JSON.parse(content);
          document = new DocumentImpl({
            ...document,
            content: JSON.stringify(jsonData, null, 2), // Prettify JSON
          });
        } catch (error) {
          console.warn('Failed to parse JSON document:', error);
        }
        break;
        
      case '.csv':
        // Simple CSV normalization (replace with proper CSV parser in production)
        document = new DocumentImpl({
          ...document,
          content: content.split('\n').map(line => line.trim()).join('\n'),
        });
        break;
        
      // Add other format-specific parsing as needed
    }
    
    return document;
  }
  
  /**
   * Create an indexable document from a regular document
   * @param document Source document
   * @param options Indexing options
   * @returns Indexable document
   */
  async createIndexableDocument(document: Document, options?: Partial<DocumentStoreConfig['indexingOptions']>): Promise<IndexableDocument> {
    const mergedOptions = {
      ...this.config.indexingOptions,
      ...options,
    };
    
    // Split the document into chunks
    const chunks = this.chunkText(document.content, mergedOptions.chunkSize, mergedOptions.chunkOverlap);
    
    // Create an indexable document
    const indexableDocument = new IndexableDocumentImpl({
      ...document,
      data: chunks.map((chunk, index) => ({
        content: chunk,
        metadata: {
          index,
          document_id: document.path || document.name,
        },
      })),
      contentCol: 'content',
      metaCol: 'metadata',
    });
    
    return indexableDocument;
  }
  
  /**
   * Apply a transformation pipeline to a document
   * @param document Document to transform
   * @param transformers Array of transformers to apply
   * @returns Transformed document
   */
  async transformDocument(document: Document, transformers: DocumentTransformer[]): Promise<Document> {
    let result = document;
    
    for (const transformer of transformers) {
      result = await transformer.transform(result);
    }
    
    return result;
  }
  
  /**
   * Get document by ID or path
   * @param idOrPath Document ID or file path
   * @returns Document if found, undefined otherwise
   */
  async getDocument(idOrPath: string): Promise<Document | undefined> {
    try {
      // First try to get from in-memory map
      const doc = this.documents.get(idOrPath);
      if (doc) {
        return doc;
      }

      // If not found and looks like a file path, try to load from disk
      if (path.isAbsolute(idOrPath) || idOrPath.includes('/') || idOrPath.includes('\\')) {
        const result = await this.loadDocument(idOrPath);
        if (result.success) {
          return result.document;
        }
        console.error(`Failed to load document from path ${idOrPath}:`, result.error);
      }

      return undefined;
    } catch (error) {
      console.error(`Error in getDocument for ${idOrPath}:`, error);
      return undefined;
    }
  }
  
  /**
   * Search for documents matching the query
   * @param query Search query
   * @param options Search options
   * @returns Array of matching documents
   */
  async searchDocuments(query: string, options?: { limit?: number, filters?: Record<string, any> }): Promise<Document[]> {
    const limit = options?.limit || 10;
    const filters = options?.filters || {};
    
    // Simple in-memory search implementation
    // This should be replaced with a proper search engine in production
    const results: Document[] = [];
    
    // Convert query to lowercase for case-insensitive search
    const lowerQuery = query.toLowerCase();
    
    for (const document of this.documents.values()) {
      // Skip documents that don't match filters
      let matchesFilters = true;
      
      for (const [key, value] of Object.entries(filters)) {
        if (document[key as keyof Document] !== value) {
          matchesFilters = false;
          break;
        }
      }
      
      if (!matchesFilters) {
        continue;
      }
      
      // Check if the document content contains the query
      if (document.content.toLowerCase().includes(lowerQuery)) {
        results.push(document);
        
        if (results.length >= limit) {
          break;
        }
      }
    }
    
    return results;
  }
  
  /**
   * Split text into chunks with optional overlap
   * @param text Text to split
   * @param chunkSize Size of each chunk
   * @param chunkOverlap Overlap between chunks
   * @returns Array of text chunks
   */
  private chunkText(text: string, chunkSize: number, chunkOverlap: number): string[] {
    const chunks: string[] = [];
    
    if (text.length <= chunkSize) {
      chunks.push(text);
      return chunks;
    }
    
    let startIndex = 0;
    
    while (startIndex < text.length) {
      let endIndex = startIndex + chunkSize;
      
      // If we're not at the end of the text
      if (endIndex < text.length) {
        // Try to find a natural breaking point (period, newline, space)
        const naturalBreak = text.indexOf('\n', endIndex - 20);
        
        if (naturalBreak !== -1 && naturalBreak < endIndex + 20) {
          endIndex = naturalBreak + 1;
        } else {
          const periodBreak = text.indexOf('. ', endIndex - 20);
          
          if (periodBreak !== -1 && periodBreak < endIndex + 20) {
            endIndex = periodBreak + 2;
          } else {
            const spaceBreak = text.lastIndexOf(' ', endIndex);
            
            if (spaceBreak !== -1 && spaceBreak > endIndex - 50) {
              endIndex = spaceBreak + 1;
            }
          }
        }
      } else {
        endIndex = text.length;
      }
      
      chunks.push(text.substring(startIndex, endIndex));
      
      // Move the start index for the next chunk, accounting for overlap
      startIndex = endIndex - chunkOverlap;
      
      // Make sure we're making progress
      if (startIndex >= text.length || startIndex <= 0) {
        break;
      }
    }
    
    return chunks;
  }
}

/**
 * Factory for creating document stores
 */
export class DocumentStoreFactory {
  /**
   * Create a basic document store
   * @param config Configuration options
   * @returns Document store instance
   */
  static createBasicStore(config?: Partial<DocumentStoreConfig>): DocumentStore {
    return new BasicDocumentStore(config);
  }
} 