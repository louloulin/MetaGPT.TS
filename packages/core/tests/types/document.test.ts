import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import path from 'path';
import fs from 'fs/promises';
import {
  DocumentStatus,
  DocumentImpl,
  IndexableDocumentImpl,
  RepoImpl,
} from '../../src/types/document';

describe('Document System', () => {
  const testDir = path.join(process.cwd(), 'test-docs');
  const testFile = path.join(testDir, 'test.txt');
  const testContent = 'Test content';

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors
    }
  });

  describe('DocumentImpl', () => {
    test('creates document with default values', () => {
      const doc = new DocumentImpl();
      expect(doc.name).toBe('');
      expect(doc.content).toBe('');
      expect(doc.author).toBe('');
      expect(doc.status).toBe(DocumentStatus.DRAFT);
      expect(doc.reviews).toEqual([]);
    });

    test('creates document from text', () => {
      const doc = DocumentImpl.fromText(testContent, testFile);
      expect(doc.content).toBe(testContent);
      expect(doc.path).toBe(testFile);
      expect(doc.name).toBe(path.basename(testFile));
    });

    test('creates document from path', async () => {
      await fs.writeFile(testFile, testContent);
      const doc = await DocumentImpl.fromPath(testFile);
      expect(doc.content).toBe(testContent);
      expect(doc.path).toBe(testFile);
      expect(doc.name).toBe(path.basename(testFile));
    });

    test('saves document to path', async () => {
      const doc = new DocumentImpl({
        content: testContent,
        path: testFile,
      });
      await doc.toPath();
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe(testContent);
    });

    test('throws error when saving without path', async () => {
      const doc = new DocumentImpl({ content: testContent });
      await expect(doc.toPath()).rejects.toThrow('File path is not set');
    });
  });

  describe('IndexableDocumentImpl', () => {
    const jsonFile = path.join(testDir, 'test.json');
    const csvFile = path.join(testDir, 'test.csv');

    test('creates indexable document from JSON', async () => {
      const jsonData = { key: 'value', content: 'test content' };
      await fs.writeFile(jsonFile, JSON.stringify(jsonData));
      const doc = await IndexableDocumentImpl.fromPath(jsonFile);
      expect(doc.data).toEqual(jsonData);
    });

    test('creates indexable document from CSV', async () => {
      const csvContent = 'header1,header2\nvalue1,value2';
      await fs.writeFile(csvFile, csvContent);
      const doc = await IndexableDocumentImpl.fromPath(csvFile);
      const data = doc.data as string[][];
      expect(Array.isArray(data)).toBe(true);
      expect(data[0]).toEqual(['header1', 'header2']);
      expect(data[1]).toEqual(['value1', 'value2']);
    });

    test('extracts docs and metadata from array data', () => {
      const data = [
        { content: 'doc1', metadata: 'meta1' },
        { content: 'doc2', metadata: 'meta2' },
      ];
      const doc = new IndexableDocumentImpl({
        data,
        contentCol: 'content',
        metaCol: 'metadata',
      });
      const [docs, metadata] = doc.getDocsAndMetadata();
      expect(docs).toEqual(['doc1', 'doc2']);
      expect(metadata).toEqual([
        { metadata: 'meta1' },
        { metadata: 'meta2' },
      ]);
    });

    test('extracts docs and metadata from record data', () => {
      const data = {
        key1: { content: 'doc1', metadata: 'meta1' },
        key2: { content: 'doc2', metadata: 'meta2' },
      };
      const doc = new IndexableDocumentImpl({
        data,
        contentCol: 'content',
        metaCol: 'metadata',
      });
      const [docs, metadata] = doc.getDocsAndMetadata();
      expect(docs).toEqual(['doc1', 'doc2']);
      expect(metadata).toEqual([
        { metadata: 'meta1' },
        { metadata: 'meta2' },
      ]);
    });
  });

  describe('RepoImpl', () => {
    test('creates repository with default values', () => {
      const repo = new RepoImpl();
      expect(repo.name).toBe('');
      expect(repo.docs).toEqual({});
      expect(repo.codes).toEqual({});
      expect(repo.assets).toEqual({});
    });

    test('creates repository from path', async () => {
      // Create test files
      const mdFile = path.join(testDir, 'test.md');
      const jsFile = path.join(testDir, 'test.js');
      const txtFile = path.join(testDir, 'test.txt');

      await fs.writeFile(mdFile, '# Test markdown');
      await fs.writeFile(jsFile, 'console.log("test");');
      await fs.writeFile(txtFile, 'Test text');

      const repo = await RepoImpl.fromPath(testDir);
      expect(repo.name).toBe(path.basename(testDir));
      expect(Object.keys(repo.docs)).toHaveLength(1); // .md file
      expect(Object.keys(repo.codes)).toHaveLength(1); // .js file
      expect(Object.keys(repo.assets)).toHaveLength(1); // .txt file
    });

    test('sets and gets documents', async () => {
      const repo = new RepoImpl({ path: testDir });
      await repo.set('test.md', '# Test');
      const doc = repo.get('test.md');
      expect(doc?.content).toBe('# Test');
    });

    test('gets text documents', async () => {
      const repo = new RepoImpl({ path: testDir });
      await repo.set('test.md', '# Test markdown');
      await repo.set('test.js', 'console.log("test");');
      await repo.set('test.txt', 'Test text');

      const textDocs = repo.getTextDocuments();
      expect(textDocs).toHaveLength(2); // .md and .js files
    });

    test('gets repository metadata', async () => {
      const repo = new RepoImpl({ path: testDir, name: 'test-repo' });
      await repo.set('test.md', '# Test');
      await repo.set('test.js', 'test');

      const metadata = repo.getMetadata();
      expect(metadata.name).toBe('test-repo');
      expect(metadata.nDocs).toBe(2);
      expect(metadata.nChars).toBe(10); // '# Test' (6 chars) + 'test' (4 chars)
    });
  });
}); 