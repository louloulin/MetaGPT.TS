import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  BasicDocumentStore, 
  DocumentStoreFactory,
  TextNormalizerTransformer
} from '../../src/document/document-store';
import { Document, DocumentImpl, DocumentStatus } from '../../src/types/document';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn()
  },
  existsSync: vi.fn(),
  mkdirSync: vi.fn()
}));

describe('Document Store', () => {
  let documentStore: BasicDocumentStore;
  
  beforeEach(() => {
    documentStore = new BasicDocumentStore({
      basePath: '/test/documents',
      enableIndexing: true
    });
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(fs.promises.readFile).mockResolvedValue('Test document content');
    vi.mocked(fs.promises.writeFile).mockResolvedValue();
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.promises.readdir).mockResolvedValue(['file1.txt', 'file2.md'] as any);
    vi.mocked(fs.promises.stat).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false
    } as any);
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe('Document Loading', () => {
    it('should load a document from a file', async () => {
      const result = await documentStore.loadDocument('/test/documents/test.txt');
      
      expect(fs.promises.readFile).toHaveBeenCalledWith('/test/documents/test.txt', 'utf-8');
      expect(result.document.content).toBe('Test document content');
      expect(result.document.path).toBe('/test/documents/test.txt');
    });
    
    it('should load documents from a directory', async () => {
      const results = await documentStore.loadDocuments('/test/documents');
      
      expect(fs.promises.readdir).toHaveBeenCalledWith('/test/documents');
      expect(fs.promises.readFile).toHaveBeenCalledTimes(2);
      expect(results.length).toBe(2);
    });
    
    it('should handle errors when loading documents', async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error('File not found'));
      
      const result = await documentStore.loadDocument('/test/documents/nonexistent.txt');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('Document Saving', () => {
    it('should save a document to a file', async () => {
      const document = new DocumentImpl({
        content: 'Document content',
        status: DocumentStatus.DRAFT,
        name: 'Test Document',
        author: 'Test Author',
        reviews: [],
        path: '/test/documents/doc1.txt'
      });
      
      await documentStore.saveDocument(document);
      
      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/test/documents/doc1.txt',
        'Document content',
        'utf-8'
      );
    });
    
    it('should handle errors when saving documents', async () => {
      vi.mocked(fs.promises.writeFile).mockRejectedValueOnce(new Error('Permission denied'));
      
      const document = new DocumentImpl({
        content: 'Document content',
        status: DocumentStatus.DRAFT,
        name: 'Test Document',
        author: 'Test Author',
        reviews: [],
        path: '/test/documents/doc1.txt'
      });
      
      const result = await documentStore.saveDocument(document);
      expect(result).toBe(false);
    });
  });
  
  describe('Document Parsing and Transformation', () => {
    it('should parse document content', async () => {
      const document = await documentStore.parseDocument('# Title\n\nContent', 'md');
      
      expect(document.content).toBe('# Title\n\nContent');
      expect(document.status).toBeDefined();
      expect(document.name).toBeDefined();
    });
    
    it('should transform documents using TextNormalizerTransformer', async () => {
      const transformer = new TextNormalizerTransformer();
      const document = new DocumentImpl({
        content: '  Text with  extra   spaces  \nand newlines\n\n',
        status: DocumentStatus.DRAFT,
        name: 'Test Document',
        author: 'Test Author',
        reviews: []
      });
      
      const transformed = await transformer.transform(document);
      
      expect(transformed.content).toBe('Text with extra spaces and newlines');
    });
    
    it('should create indexable documents', async () => {
      const document = new DocumentImpl({
        content: 'Document content for indexing',
        status: DocumentStatus.DRAFT,
        name: 'Test Document',
        author: 'Test Author',
        reviews: [],
        path: '/test/documents/doc1.txt'
      });
      
      const indexable = await documentStore.createIndexableDocument(document);
      
      expect(indexable.name).toBe('Test Document');
      expect(indexable.content).toBe('Document content for indexing');
      expect(indexable.data).toBeDefined();
    });
  });
  
  describe('Document Retrieval and Search', () => {
    it('should get a document by ID', async () => {
      // Setup the document store with a sample document
      const doc = new DocumentImpl({
        content: 'Test content',
        status: DocumentStatus.DRAFT,
        name: 'Test Document',
        author: 'Test Author',
        reviews: [],
        path: '/test/documents/doc1.txt'
      });
      
      // Mock the documents map
      (documentStore as any).documents.set('doc1', doc);
      
      const document = await documentStore.getDocument('doc1');
      
      expect(document).toBeDefined();
      expect(document?.content).toBe('Test content');
      expect(document?.path).toBe('/test/documents/doc1.txt');
    });
    
    it('should get a document by path', async () => {
      // Setup the document store with a sample document
      const doc = new DocumentImpl({
        content: 'Test content',
        status: DocumentStatus.DRAFT,
        name: 'Test Document',
        author: 'Test Author',
        reviews: [],
        path: '/test/documents/doc1.txt'
      });
      
      // Mock the documents map
      (documentStore as any).documents.set('doc1', doc);
      
      const document = await documentStore.getDocument('/test/documents/doc1.txt');
      
      expect(document).toBeDefined();
      expect(document?.content).toBe('Test content');
      expect(document?.path).toBe('/test/documents/doc1.txt');
    });
    
    it('should return undefined for nonexistent documents', async () => {
      const document = await documentStore.getDocument('nonexistent');
      expect(document).toBeUndefined();
    });
    
    it('should search documents (stub implementation)', async () => {
      // Since the actual search would depend on a vector database,
      // we just test the basic implementation here
      const results = await documentStore.searchDocuments('test query');
      expect(Array.isArray(results)).toBe(true);
    });
  });
  
  describe('DocumentStoreFactory', () => {
    it('should create a document store with default configuration', () => {
      const store = DocumentStoreFactory.createBasicStore();
      
      expect(store).toBeInstanceOf(BasicDocumentStore);
      expect((store as any).config.basePath).toBeDefined();
    });
    
    it('should create a document store with custom configuration', () => {
      const store = DocumentStoreFactory.createBasicStore({
        basePath: '/custom/path',
        enableIndexing: false
      });
      
      expect(store).toBeInstanceOf(BasicDocumentStore);
      expect((store as any).config.basePath).toBe('/custom/path');
      expect((store as any).config.enableIndexing).toBe(false);
    });
  });
}); 