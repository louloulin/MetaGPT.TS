/**
 * Knowledge Graph Example
 * 
 * This example demonstrates how to use the knowledge graph system in MetaGPT-TS.
 * It shows how to:
 * 1. Create and manage a distributed knowledge graph
 * 2. Extract entities and relations from text
 * 3. Query the knowledge graph
 * 4. Visualize the knowledge graph
 */

import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeGraphManager } from '../src/knowledge/distributed-kg';
import type { KnowledgeNode, KnowledgeEdge } from '../src/knowledge/distributed-kg';
import { EntityRelationExtractor, type ExtractedEntity, type ExtractedRelation, type Triple } from '../src/knowledge/entity-relation-extractor';
import { KGQueryEngine } from '../src/knowledge/kg-query-engine';
import { KGVisualizer } from '../src/knowledge/kg-visualizer';
import { OpenAIProvider } from '../src/llm/openai-provider';
import { logger } from '../src/utils/logger';

// Sample text for entity and relation extraction
const sampleText = `
Apple Inc. is an American multinational technology company headquartered in Cupertino, California. 
Tim Cook is the CEO of Apple Inc. since 2011, succeeding Steve Jobs who was the co-founder of Apple.
Apple develops and sells consumer electronics, computer software, and online services. 
The company's hardware products include the iPhone, iPad, Mac, Apple Watch, and Apple TV.
Apple's software includes macOS, iOS, iPadOS, watchOS, and tvOS operating systems.
`;

// Ensure output directory exists
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Main function to demonstrate knowledge graph capabilities
 */
async function main() {
  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error('Please set the OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  // Initialize LLM provider
  const llmProvider = new OpenAIProvider({
    apiKey,
    defaultModel: 'gpt-4-turbo',
  });

  logger.info('Initializing knowledge graph components...');

  // Initialize knowledge graph manager
  const kgManager = new KnowledgeGraphManager();

  // Initialize entity relation extractor
  const entityExtractor = new EntityRelationExtractor({
    llmProvider,
    confidenceThreshold: 0.7,
    maxEntities: 10,
    maxRelations: 15,
  });

  // Initialize query engine
  const queryEngine = new KGQueryEngine({
    llmProvider,
    maxPathLength: 3,
    maxPaths: 5,
    useLLMForReasoning: true,
  });

  // Initialize visualizer
  const visualizer = new KGVisualizer({
    nodeColorMap: {
      Person: '#ff7f0e',
      Organization: '#1f77b4',
      Product: '#2ca02c',
      Software: '#9467bd',
    },
  });

  // Step 1: Extract entities and relations from text
  logger.info('Extracting entities and relations from text...');
  const extractionResult = await entityExtractor.extractTriples(sampleText);
  
  // Type assertion for the extraction result
  const entities = extractionResult.entities as ExtractedEntity[];
  const relations = extractionResult.relations as ExtractedRelation[];
  const triples = extractionResult.triples as Triple[];
  
  logger.info(`Extracted ${entities.length} entities and ${relations.length} relations`);
  logger.info(`Extracted ${triples.length} triples`);
  
  // Log extracted entities
  logger.info('Extracted entities:');
  entities.forEach((entity: ExtractedEntity) => {
    logger.info(`- ${entity.name} (${entity.type}): ${entity.description}`);
  });

  // Log extracted relations
  logger.info('Extracted relations:');
  relations.forEach((relation: ExtractedRelation) => {
    logger.info(`- ${relation.sourceEntity} ${relation.type} ${relation.targetEntity}`);
  });

  // Step 2: Convert extracted data to knowledge graph nodes and edges
  logger.info('Converting extracted data to knowledge graph nodes and edges...');
  const { nodes, edges } = entityExtractor.convertToKnowledgeGraph(
    entities,
    relations
  );

  // Step 3: Add nodes and edges to the knowledge graph
  logger.info('Adding nodes and edges to the knowledge graph...');
  nodes.forEach(node => kgManager.addNode(node));
  edges.forEach(edge => kgManager.addEdge(edge));

  logger.info(`Knowledge graph now has ${kgManager.getNodeCount()} nodes and ${kgManager.getEdgeCount()} edges`);

  // Step 4: Query the knowledge graph
  logger.info('Querying the knowledge graph...');
  
  // Find paths between nodes
  const appleNode = nodes.find(node => node.properties.name === 'Apple Inc.');
  const timCookNode = nodes.find(node => node.properties.name === 'Tim Cook');
  
  if (appleNode && timCookNode) {
    const paths = await queryEngine.findPaths(kgManager, appleNode.id, timCookNode.id);
    logger.info(`Found ${paths.length} paths between Apple Inc. and Tim Cook`);
    paths.forEach((path, index) => {
      logger.info(`Path ${index + 1}:`);
      path.forEach(item => {
        if ('type' in item && 'properties' in item) {
          // This is a node
          logger.info(`  Node: ${item.properties.name || item.id} (${item.type})`);
        } else if ('sourceId' in item && 'targetId' in item) {
          // This is an edge
          logger.info(`  Edge: ${item.type}`);
        }
      });
    });
  }

  // Natural language query
  const query = "What products does Apple develop?";
  logger.info(`Executing natural language query: "${query}"`);
  const queryResult = await queryEngine.query(kgManager, query);
  
  logger.info('Query result:');
  logger.info(queryResult.answer);
  
  if (queryResult.relevantNodes.length > 0) {
    logger.info('Relevant nodes:');
    queryResult.relevantNodes.forEach(nodeId => {
      const node = kgManager.getNode(nodeId);
      if (node) {
        logger.info(`- ${node.properties.name || node.id} (${node.type})`);
      }
    });
  }

  // Step 5: Visualize the knowledge graph
  logger.info('Visualizing the knowledge graph...');
  
  // Get all nodes and edges from the knowledge graph
  const allNodes = kgManager.getAllNodes();
  const allEdges = kgManager.getAllEdges();
  
  // Convert to visualization formats
  const visGraph = visualizer.toVisGraph(allNodes, allEdges);
  const d3Format = visualizer.toD3Format(allNodes, allEdges);
  const cytoscapeFormat = visualizer.toCytoscapeFormat(allNodes, allEdges);
  const dotFormat = visualizer.toDotFormat(allNodes, allEdges);
  const jsonLdFormat = visualizer.toJsonLd(allNodes, allEdges);
  
  // Save visualization formats to files
  fs.writeFileSync(path.join(outputDir, 'kg-vis-graph.json'), JSON.stringify(visGraph, null, 2));
  fs.writeFileSync(path.join(outputDir, 'kg-d3.json'), JSON.stringify(d3Format, null, 2));
  fs.writeFileSync(path.join(outputDir, 'kg-cytoscape.json'), JSON.stringify(cytoscapeFormat, null, 2));
  fs.writeFileSync(path.join(outputDir, 'kg-dot.dot'), dotFormat);
  fs.writeFileSync(path.join(outputDir, 'kg-jsonld.json'), JSON.stringify(jsonLdFormat, null, 2));
  
  logger.info('Knowledge graph visualization files saved to output directory');

  // Step 6: Infer new knowledge
  logger.info('Inferring new knowledge...');
  const inferenceResult = await queryEngine.inferNewKnowledge(kgManager, "What operating system might the iPhone use?");
  
  logger.info('Inference result:');
  logger.info(inferenceResult.inference);
  
  if (inferenceResult.confidence > 0.7) {
    logger.info('Adding inferred knowledge to the graph...');
    inferenceResult.newNodes.forEach(node => kgManager.addNode(node));
    inferenceResult.newEdges.forEach(edge => kgManager.addEdge(edge));
    
    logger.info(`Knowledge graph now has ${kgManager.getNodeCount()} nodes and ${kgManager.getEdgeCount()} edges after inference`);
  }

  logger.info('Knowledge graph example completed successfully');
}

// Run the example
main().catch(error => {
  logger.error('Error running knowledge graph example:', error);
  process.exit(1);
}); 