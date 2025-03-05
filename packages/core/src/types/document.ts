import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';

/**
 * Document status enum, similar to RFC/PEP
 */
export enum DocumentStatus {
  DRAFT = 'draft',
  UNDERREVIEW = 'underreview',
  APPROVED = 'approved',
  DONE = 'done',
}

/**
 * Base document schema
 */
export const DocumentSchema = z.object({
  path: z.string().optional(),
  name: z.string().default(''),
  content: z.string().default(''),
  author: z.string().default(''),
  status: z.nativeEnum(DocumentStatus).default(DocumentStatus.DRAFT),
  reviews: z.array(z.any()).default([]),
});

/**
 * Indexable document schema for vector databases or search engines
 */
export const IndexableDocumentSchema = DocumentSchema.extend({
  data: z.union([z.array(z.any()), z.record(z.string(), z.any())]),
  contentCol: z.string().default(''),
  metaCol: z.string().default(''),
});

/**
 * Repository metadata schema
 */
export const RepoMetadataSchema = z.object({
  name: z.string().default(''),
  nDocs: z.number().default(0),
  nChars: z.number().default(0),
  symbols: z.array(z.any()).default([]),
});

/**
 * Repository schema
 */
export const RepoSchema = z.object({
  name: z.string().default(''),
  docs: z.record(z.string(), DocumentSchema).default({}),
  codes: z.record(z.string(), DocumentSchema).default({}),
  assets: z.record(z.string(), DocumentSchema).default({}),
  path: z.string().optional(),
});

/**
 * Document types
 */
export type Document = z.infer<typeof DocumentSchema> & {
  toPath?: (path?: string) => Promise<void>;
};
export type IndexableDocument = z.infer<typeof IndexableDocumentSchema>;
export type RepoMetadata = z.infer<typeof RepoMetadataSchema>;
export type Repo = z.infer<typeof RepoSchema>;

/**
 * Document class implementation
 */
export class DocumentImpl implements Document {
  public path?: string;
  public name: string = '';
  public content: string = '';
  public author: string = '';
  public status: DocumentStatus = DocumentStatus.DRAFT;
  public reviews: any[] = [];

  constructor(data: Partial<Document> = {}) {
    Object.assign(this, DocumentSchema.parse(data));
  }

  /**
   * Create a Document instance from a file path
   */
  public static async fromPath(filePath: string): Promise<DocumentImpl> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return new DocumentImpl({
        content,
        path: filePath,
        name: path.basename(filePath),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read file ${filePath}: ${message}`);
    }
  }

  /**
   * Create a Document from a text string
   */
  public static fromText(text: string, filePath?: string): DocumentImpl {
    return new DocumentImpl({
      content: text,
      path: filePath,
      name: filePath ? path.basename(filePath) : '',
    });
  }

  /**
   * Save content to the specified file path
   */
  public async toPath(filePath?: string): Promise<void> {
    const targetPath = filePath || this.path;
    if (!targetPath) {
      throw new Error('File path is not set.');
    }

    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, this.content, 'utf-8');
      this.path = targetPath;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to write file ${targetPath}: ${message}`);
    }
  }

  /**
   * Persist document to disk
   */
  public async persist(): Promise<void> {
    return this.toPath();
  }
}

/**
 * Indexable document class implementation
 */
export class IndexableDocumentImpl extends DocumentImpl implements IndexableDocument {
  public data: any[] | Record<string, any>;
  public contentCol: string = '';
  public metaCol: string = '';

  constructor(data: Partial<IndexableDocument> = {}) {
    super(data);
    const parsed = IndexableDocumentSchema.parse(data);
    this.data = parsed.data;
    this.contentCol = parsed.contentCol;
    this.metaCol = parsed.metaCol;
  }

  /**
   * Create an IndexableDocument instance from a file path
   */
  public static async fromPath(
    filePath: string,
    contentCol: string = 'content',
    metaCol: string = 'metadata'
  ): Promise<IndexableDocumentImpl> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      let data: any[] | Record<string, any>;

      // Parse data based on file extension
      const ext = path.extname(filePath).toLowerCase();
      switch (ext) {
        case '.json':
          data = JSON.parse(content);
          break;
        case '.csv':
          // Simple CSV parsing (for more complex needs, use a CSV library)
          data = content.split('\n').map(line => line.split(','));
          break;
        default:
          data = [{ content }];
      }

      return new IndexableDocumentImpl({
        content,
        path: filePath,
        name: path.basename(filePath),
        data,
        contentCol,
        metaCol,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read file ${filePath}: ${message}`);
    }
  }

  /**
   * Get documents and metadata from the data
   */
  public getDocsAndMetadata(): [string[], Record<string, any>[]] {
    const docs: string[] = [];
    const metadata: Record<string, any>[] = [];

    if (Array.isArray(this.data)) {
      // Handle array data
      this.data.forEach(item => {
        const content = typeof item === 'string' ? item : item[this.contentCol] || '';
        docs.push(content);
        metadata.push(this.metaCol && typeof item === 'object' ? { [this.metaCol]: item[this.metaCol] } : {});
      });
    } else {
      // Handle record data
      Object.entries(this.data).forEach(([key, value]) => {
        const content = typeof value === 'string' ? value : value[this.contentCol] || '';
        docs.push(content);
        metadata.push(this.metaCol && typeof value === 'object' ? { [this.metaCol]: value[this.metaCol] } : {});
      });
    }

    return [docs, metadata];
  }
}

/**
 * Repository class implementation
 */
export class RepoImpl implements Repo {
  public name: string = '';
  public docs: Record<string, Document> = {};
  public codes: Record<string, Document> = {};
  public assets: Record<string, Document> = {};
  public path?: string;

  constructor(data: Partial<Repo> = {}) {
    Object.assign(this, RepoSchema.parse(data));
  }

  private _path(filename: string): string {
    if (!this.path) {
      throw new Error('Repository path is not set.');
    }
    return path.join(this.path, filename);
  }

  /**
   * Create a Repo instance from a directory path
   */
  public static async fromPath(dirPath: string): Promise<RepoImpl> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      const repo = new RepoImpl({
        path: dirPath,
        name: path.basename(dirPath),
      });

      // Read all files recursively
      const readDir = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await readDir(fullPath);
          } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.json', '.txt', '.md', '.py', '.js', '.css', '.html'].includes(ext)) {
              const content = await fs.readFile(fullPath, 'utf-8');
              await repo._set(content, fullPath);
            }
          }
        }
      };

      await readDir(dirPath);
      return repo;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create repository from ${dirPath}: ${message}`);
    }
  }

  /**
   * Save all documents to disk
   */
  public async toPath(): Promise<void> {
    const saveAll = async (docs: Record<string, Document>) => {
      for (const doc of Object.values(docs)) {
        if (doc instanceof DocumentImpl && doc.toPath) {
          await doc.toPath();
        }
      }
    };

    await Promise.all([
      saveAll(this.docs),
      saveAll(this.codes),
      saveAll(this.assets),
    ]);
  }

  private async _set(content: string, filePath: string): Promise<Document> {
    const ext = path.extname(filePath).toLowerCase();
    const doc = new DocumentImpl({
      content,
      path: filePath,
      name: path.relative(this.path || '', filePath),
    });

    if (ext === '.md') {
      this.docs[filePath] = doc;
    } else if (['.py', '.js', '.css', '.html'].includes(ext)) {
      this.codes[filePath] = doc;
    } else {
      this.assets[filePath] = doc;
    }

    return doc;
  }

  /**
   * Set a document and persist it to disk
   */
  public async set(filename: string, content: string): Promise<void> {
    const filePath = this._path(filename);
    const doc = await this._set(content, filePath);
    await doc.toPath();
  }

  /**
   * Get a document by its filename
   */
  public get(filename: string): Document | undefined {
    const filePath = this._path(filename);
    return this.docs[filePath] || this.codes[filePath] || this.assets[filePath];
  }

  /**
   * Get all text documents
   */
  public getTextDocuments(): Document[] {
    return [...Object.values(this.docs), ...Object.values(this.codes)];
  }

  /**
   * Get repository metadata
   */
  public getMetadata(): RepoMetadata {
    const nDocs = Object.keys(this.docs).length + Object.keys(this.codes).length + Object.keys(this.assets).length;
    const nChars = [...Object.values(this.docs), ...Object.values(this.codes), ...Object.values(this.assets)]
      .reduce((sum, doc) => sum + doc.content.length, 0);

    return {
      name: this.name,
      nDocs,
      nChars,
      symbols: [], // TODO: Implement symbol extraction
    };
  }
} 