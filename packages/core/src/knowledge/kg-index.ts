/**
 * Knowledge Graph Index Manager
 * 
 * Provides indexing and efficient querying capabilities for the distributed knowledge graph.
 * Supports multiple index types:
 * 1. Property index - for fast lookups based on node/edge properties
 * 2. Type index - for efficient filtering by node/edge types
 * 3. Full-text index - for text search across properties
 */

import type { KnowledgeNode, KnowledgeEdge } from './distributed-kg';
import { logger } from '../utils/logger';

interface IndexEntry {
  id: string;
  type: 'node' | 'edge';
  value: string;
  propertyPath: string[];
}

export class KGIndexManager {
  private propertyIndex: Map<string, Set<IndexEntry>>;
  private typeIndex: Map<string, Set<string>>;
  private textIndex: Map<string, Set<IndexEntry>>;

  constructor() {
    this.propertyIndex = new Map();
    this.typeIndex = new Map();
    this.textIndex = new Map();
  }

  /**
   * Index a node's properties
   */
  public indexNode(node: KnowledgeNode): void {
    // Index node type
    this.addToTypeIndex('node', node.type, node.id);

    // Index node properties
    this.indexProperties('node', node.id, node.properties);
  }

  /**
   * Index an edge's properties
   */
  public indexEdge(edge: KnowledgeEdge): void {
    // Index edge type
    this.addToTypeIndex('edge', edge.type, edge.id);

    // Index edge properties
    this.indexProperties('edge', edge.id, edge.properties);
  }

  /**
   * Remove node from indices
   */
  public removeNodeIndex(nodeId: string): void {
    this.removeFromIndices('node', nodeId);
  }

  /**
   * Remove edge from indices
   */
  public removeEdgeIndex(edgeId: string): void {
    this.removeFromIndices('edge', edgeId);
  }

  /**
   * Query nodes by property value
   */
  public queryByProperty(propertyPath: string[], value: any): Set<string> {
    const key = this.getPropertyKey(propertyPath, value);
    const entries = this.propertyIndex.get(key) || new Set();
    return new Set(Array.from(entries).filter(e => e.type === 'node').map(e => e.id));
  }

  /**
   * Query nodes by type
   */
  public queryByType(type: string): Set<string> {
    return this.typeIndex.get(`node:${type}`) || new Set();
  }

  /**
   * Full-text search across node properties
   */
  public searchText(query: string): Set<string> {
    const results = new Set<string>();
    const searchTerms = query.toLowerCase().split(/\s+/);

    for (const term of searchTerms) {
      for (const [key, entries] of this.textIndex.entries()) {
        if (key.includes(term)) {
          for (const entry of entries) {
            if (entry.type === 'node') {
              results.add(entry.id);
            }
          }
        }
      }
    }

    return results;
  }

  private indexProperties(entityType: 'node' | 'edge', id: string, properties: Record<string, any>, parentPath: string[] = []): void {
    for (const [key, value] of Object.entries(properties)) {
      const currentPath = [...parentPath, key];

      if (typeof value === 'object' && value !== null) {
        // Recursively index nested properties
        this.indexProperties(entityType, id, value, currentPath);
      } else {
        // Index primitive values
        const propertyKey = this.getPropertyKey(currentPath, value);
        const entry: IndexEntry = {
          id,
          type: entityType,
          value: String(value),
          propertyPath: currentPath,
        };

        // Add to property index
        if (!this.propertyIndex.has(propertyKey)) {
          this.propertyIndex.set(propertyKey, new Set());
        }
        this.propertyIndex.get(propertyKey)!.add(entry);

        // Add to text index if value is string
        if (typeof value === 'string') {
          const textKey = value.toLowerCase();
          if (!this.textIndex.has(textKey)) {
            this.textIndex.set(textKey, new Set());
          }
          this.textIndex.get(textKey)!.add(entry);
        }
      }
    }
  }

  private addToTypeIndex(entityType: 'node' | 'edge', type: string, id: string): void {
    const key = `${entityType}:${type}`;
    if (!this.typeIndex.has(key)) {
      this.typeIndex.set(key, new Set());
    }
    this.typeIndex.get(key)!.add(id);
  }

  private removeFromIndices(entityType: 'node' | 'edge', id: string): void {
    // Remove from property index
    for (const entries of this.propertyIndex.values()) {
      for (const entry of entries) {
        if (entry.id === id && entry.type === entityType) {
          entries.delete(entry);
        }
      }
    }

    // Remove from type index
    for (const [key, ids] of this.typeIndex.entries()) {
      if (key.startsWith(entityType)) {
        ids.delete(id);
      }
    }

    // Remove from text index
    for (const entries of this.textIndex.values()) {
      for (const entry of entries) {
        if (entry.id === id && entry.type === entityType) {
          entries.delete(entry);
        }
      }
    }
  }

  private getPropertyKey(path: string[], value: any): string {
    return `${path.join('.')}:${value}`;
  }
} 