/**
 * Knowledge Graph Visualizer
 * 
 * Provides tools to visualize the knowledge graph in various formats.
 * Supports conversion to formats compatible with visualization libraries.
 */

import { logger } from '../utils/logger';
import type { KnowledgeNode, KnowledgeEdge } from './distributed-kg';

/**
 * Represents a node in the visualization format
 */
export interface VisNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
  color?: string;
  size?: number;
}

/**
 * Represents an edge in the visualization format
 */
export interface VisEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  properties: Record<string, any>;
  color?: string;
  width?: number;
}

/**
 * Represents a graph in the visualization format
 */
export interface VisGraph {
  nodes: VisNode[];
  edges: VisEdge[];
}

/**
 * Configuration options for the knowledge graph visualizer
 */
export interface KGVisualizerOptions {
  /**
   * Color map for node types
   */
  nodeColorMap?: Record<string, string>;
  
  /**
   * Color map for edge types
   */
  edgeColorMap?: Record<string, string>;
  
  /**
   * Default node color
   */
  defaultNodeColor?: string;
  
  /**
   * Default edge color
   */
  defaultEdgeColor?: string;
  
  /**
   * Node size calculation function
   */
  nodeSizeFunction?: (node: KnowledgeNode) => number;
  
  /**
   * Edge width calculation function
   */
  edgeWidthFunction?: (edge: KnowledgeEdge) => number;
}

/**
 * Default options for the knowledge graph visualizer
 */
const DEFAULT_OPTIONS: KGVisualizerOptions = {
  nodeColorMap: {
    Person: '#ff7f0e',
    Organization: '#1f77b4',
    Location: '#2ca02c',
    Concept: '#9467bd',
    Event: '#d62728',
    Product: '#8c564b',
  },
  edgeColorMap: {
    worksFor: '#1f77b4',
    locatedIn: '#2ca02c',
    knows: '#ff7f0e',
    hasProperty: '#9467bd',
    participatedIn: '#d62728',
    created: '#8c564b',
  },
  defaultNodeColor: '#aaaaaa',
  defaultEdgeColor: '#999999',
  nodeSizeFunction: (node) => {
    // Size based on number of connections or importance
    return 5;
  },
  edgeWidthFunction: (edge) => {
    // Width based on confidence or importance
    const confidence = (edge.properties.confidence as number) || 0.5;
    return 1 + confidence * 2;
  },
};

/**
 * Knowledge Graph Visualizer
 * 
 * Provides tools to visualize the knowledge graph in various formats.
 */
export class KGVisualizer {
  private options: KGVisualizerOptions;
  
  /**
   * Creates a new KGVisualizer
   * 
   * @param options - Configuration options
   */
  constructor(options?: Partial<KGVisualizerOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Converts knowledge graph nodes and edges to a visualization format
   * 
   * @param nodes - The knowledge graph nodes
   * @param edges - The knowledge graph edges
   * @returns A graph in the visualization format
   */
  public toVisGraph(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): VisGraph {
    const visNodes = this.nodesToVisNodes(nodes);
    const visEdges = this.edgesToVisEdges(edges);
    
    return { nodes: visNodes, edges: visEdges };
  }
  
  /**
   * Converts knowledge graph nodes to visualization nodes
   * 
   * @param nodes - The knowledge graph nodes
   * @returns An array of visualization nodes
   */
  public nodesToVisNodes(nodes: KnowledgeNode[]): VisNode[] {
    return nodes.map(node => {
      const color = this.getNodeColor(node);
      const size = this.getNodeSize(node);
      const nodeName = node.properties.name ? String(node.properties.name) : node.id;
      
      return {
        id: node.id,
        label: nodeName,
        type: node.type,
        properties: node.properties,
        color,
        size,
      };
    });
  }
  
  /**
   * Converts knowledge graph edges to visualization edges
   * 
   * @param edges - The knowledge graph edges
   * @returns An array of visualization edges
   */
  public edgesToVisEdges(edges: KnowledgeEdge[]): VisEdge[] {
    return edges.map(edge => {
      const color = this.getEdgeColor(edge);
      const width = this.getEdgeWidth(edge);
      
      return {
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        label: edge.type,
        type: edge.type,
        properties: edge.properties,
        color,
        width,
      };
    });
  }
  
  /**
   * Converts a knowledge graph to a D3.js compatible format
   * 
   * @param nodes - The knowledge graph nodes
   * @param edges - The knowledge graph edges
   * @returns A D3.js compatible graph
   */
  public toD3Format(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): {
    nodes: Array<{ id: string; group: string; label: string; properties: Record<string, any> }>;
    links: Array<{ source: string; target: string; value: number; label: string }>;
  } {
    const d3Nodes = nodes.map(node => ({
      id: node.id,
      group: node.type,
      label: node.properties.name ? String(node.properties.name) : node.id,
      properties: node.properties,
    }));
    
    const d3Links = edges.map(edge => ({
      source: edge.sourceId,
      target: edge.targetId,
      value: this.getEdgeWidth(edge),
      label: edge.type,
    }));
    
    return { nodes: d3Nodes, links: d3Links };
  }
  
  /**
   * Converts a knowledge graph to a Cytoscape.js compatible format
   * 
   * @param nodes - The knowledge graph nodes
   * @param edges - The knowledge graph edges
   * @returns A Cytoscape.js compatible graph
   */
  public toCytoscapeFormat(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): Array<{
    data: Record<string, any>;
    group: 'nodes' | 'edges';
  }> {
    const elements: Array<{ data: Record<string, any>; group: 'nodes' | 'edges' }> = [];
    
    // Add nodes
    for (const node of nodes) {
      elements.push({
        data: {
          id: node.id,
          label: node.properties.name ? String(node.properties.name) : node.id,
          type: node.type,
          properties: node.properties,
          color: this.getNodeColor(node),
        },
        group: 'nodes',
      });
    }
    
    // Add edges
    for (const edge of edges) {
      elements.push({
        data: {
          id: edge.id,
          source: edge.sourceId,
          target: edge.targetId,
          label: edge.type,
          type: edge.type,
          properties: edge.properties,
          color: this.getEdgeColor(edge),
          width: this.getEdgeWidth(edge),
        },
        group: 'edges',
      });
    }
    
    return elements;
  }
  
  /**
   * Converts a knowledge graph to a GraphViz DOT format
   * 
   * @param nodes - The knowledge graph nodes
   * @param edges - The knowledge graph edges
   * @returns A GraphViz DOT format string
   */
  public toDotFormat(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): string {
    let dot = 'digraph KnowledgeGraph {\n';
    
    // Add graph settings
    dot += '  graph [rankdir=LR, fontname="Arial"];\n';
    dot += '  node [shape=box, style=filled, fontname="Arial"];\n';
    dot += '  edge [fontname="Arial"];\n\n';
    
    // Add nodes
    for (const node of nodes) {
      const label = node.properties.name ? String(node.properties.name) : node.id;
      const color = this.getNodeColor(node).replace('#', '');
      
      dot += `  "${node.id}" [label="${label}", fillcolor="#${color}"];\n`;
    }
    
    dot += '\n';
    
    // Add edges
    for (const edge of edges) {
      const label = edge.type;
      const color = this.getEdgeColor(edge).replace('#', '');
      
      dot += `  "${edge.sourceId}" -> "${edge.targetId}" [label="${label}", color="#${color}"];\n`;
    }
    
    dot += '}\n';
    
    return dot;
  }
  
  /**
   * Converts a knowledge graph to a JSON-LD format
   * 
   * @param nodes - The knowledge graph nodes
   * @param edges - The knowledge graph edges
   * @returns A JSON-LD format object
   */
  public toJsonLd(nodes: KnowledgeNode[], edges: KnowledgeEdge[]): Record<string, any> {
    const context: Record<string, any> = {
      '@vocab': 'http://schema.org/',
      kg: 'http://example.org/kg/',
    };
    
    const graph: Array<Record<string, any>> = [];
    
    // Add nodes
    for (const node of nodes) {
      const jsonLdNode: Record<string, any> = {
        '@id': `kg:${node.id}`,
        '@type': node.type,
      };
      
      // Add properties
      for (const [key, value] of Object.entries(node.properties)) {
        if (key !== 'name' && key !== 'mentions' && key !== 'confidence') {
          jsonLdNode[key] = value;
        }
      }
      
      // Add name
      if (node.properties.name) {
        jsonLdNode.name = String(node.properties.name);
      }
      
      graph.push(jsonLdNode);
    }
    
    // Add edges
    for (const edge of edges) {
      const sourceNode = nodes.find(n => n.id === edge.sourceId);
      const targetNode = nodes.find(n => n.id === edge.targetId);
      
      if (!sourceNode || !targetNode) {
        continue;
      }
      
      // Find the source node in the graph
      const sourceJsonLdNode = graph.find(n => n['@id'] === `kg:${edge.sourceId}`);
      
      if (!sourceJsonLdNode) {
        continue;
      }
      
      // Add the relation to the source node
      sourceJsonLdNode[`kg:${edge.type}`] = {
        '@id': `kg:${edge.targetId}`,
      };
    }
    
    return {
      '@context': context,
      '@graph': graph,
    };
  }
  
  /**
   * Gets the color for a node
   * 
   * @param node - The knowledge graph node
   * @returns The color for the node
   */
  private getNodeColor(node: KnowledgeNode): string {
    const colorMap = this.options.nodeColorMap || {};
    return colorMap[node.type] || this.options.defaultNodeColor || '#aaaaaa';
  }
  
  /**
   * Gets the size for a node
   * 
   * @param node - The knowledge graph node
   * @returns The size for the node
   */
  private getNodeSize(node: KnowledgeNode): number {
    if (this.options.nodeSizeFunction) {
      return this.options.nodeSizeFunction(node);
    }
    
    // Default size
    return 5;
  }
  
  /**
   * Gets the color for an edge
   * 
   * @param edge - The knowledge graph edge
   * @returns The color for the edge
   */
  private getEdgeColor(edge: KnowledgeEdge): string {
    const colorMap = this.options.edgeColorMap || {};
    return colorMap[edge.type] || this.options.defaultEdgeColor || '#999999';
  }
  
  /**
   * Gets the width for an edge
   * 
   * @param edge - The knowledge graph edge
   * @returns The width for the edge
   */
  private getEdgeWidth(edge: KnowledgeEdge): number {
    if (this.options.edgeWidthFunction) {
      return this.options.edgeWidthFunction(edge);
    }
    
    // Default width based on confidence
    const confidence = (edge.properties.confidence as number) || 0.5;
    return 1 + confidence * 2;
  }
} 