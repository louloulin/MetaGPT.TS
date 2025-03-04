/**
 * Entity Relation Extractor
 * 
 * Extracts entities, relations, and triples (SPO: Subject-Predicate-Object) from text
 * to build and enhance the knowledge graph.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import type { LLMProvider } from '../llm/llm-provider';
import type { KnowledgeNode, KnowledgeEdge } from './distributed-kg';

/**
 * Represents a triple (Subject-Predicate-Object)
 */
export interface Triple {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  sourceText: string;
  sourceLocation?: string;
}

/**
 * Represents an extracted entity
 */
export interface ExtractedEntity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
  mentions: string[];
  confidence: number;
}

/**
 * Represents an extracted relation
 */
export interface ExtractedRelation {
  id: string;
  type: string;
  sourceEntityId: string;
  targetEntityId: string;
  properties: Record<string, any>;
  confidence: number;
}

/**
 * Configuration options for entity relation extraction
 */
export interface EntityRelationExtractorOptions {
  /**
   * Minimum confidence threshold for extracted entities and relations
   */
  confidenceThreshold: number;
  
  /**
   * Maximum number of entities to extract from a text
   */
  maxEntities: number;
  
  /**
   * Maximum number of relations to extract from a text
   */
  maxRelations: number;
  
  /**
   * Whether to extract properties for entities
   */
  extractProperties: boolean;
  
  /**
   * Custom prompt template for entity extraction
   */
  entityExtractionPrompt?: string;
  
  /**
   * Custom prompt template for relation extraction
   */
  relationExtractionPrompt?: string;
}

/**
 * Default options for entity relation extraction
 */
const DEFAULT_OPTIONS: EntityRelationExtractorOptions = {
  confidenceThreshold: 0.7,
  maxEntities: 20,
  maxRelations: 30,
  extractProperties: true,
};

/**
 * Default prompt template for entity extraction
 */
const DEFAULT_ENTITY_EXTRACTION_PROMPT = `
Extract entities from the following text. For each entity, identify its type and properties.
Return the result as a JSON array of objects with the following structure:
[
  {
    "name": "entity name",
    "type": "entity type (e.g., Person, Organization, Location, Concept, etc.)",
    "properties": {
      "property1": "value1",
      "property2": "value2"
    },
    "mentions": ["mention1", "mention2"],
    "confidence": 0.95
  }
]

Text:
{{text}}
`;

/**
 * Default prompt template for relation extraction
 */
const DEFAULT_RELATION_EXTRACTION_PROMPT = `
Extract relationships between entities in the following text. 
The entities are:
{{entities}}

Return the result as a JSON array of objects with the following structure:
[
  {
    "sourceEntity": "source entity name",
    "targetEntity": "target entity name",
    "type": "relation type (e.g., worksFor, locatedIn, hasProperty, etc.)",
    "properties": {
      "property1": "value1",
      "property2": "value2"
    },
    "confidence": 0.95
  }
]

Text:
{{text}}
`;

/**
 * Default prompt template for triple extraction
 */
const DEFAULT_TRIPLE_EXTRACTION_PROMPT = `
Extract Subject-Predicate-Object (SPO) triples from the following text.
Return the result as a JSON array of objects with the following structure:
[
  {
    "subject": "subject entity",
    "predicate": "relation",
    "object": "object entity",
    "confidence": 0.95
  }
]

Text:
{{text}}
`;

/**
 * Entity Relation Extractor
 * 
 * Extracts entities, relations, and triples from text to build and enhance the knowledge graph.
 */
export class EntityRelationExtractor {
  private llmProvider: LLMProvider;
  private options: EntityRelationExtractorOptions;
  
  /**
   * Creates a new EntityRelationExtractor
   * 
   * @param llmProvider - The LLM provider to use for extraction
   * @param options - Configuration options
   */
  constructor(llmProvider: LLMProvider, options?: Partial<EntityRelationExtractorOptions>) {
    this.llmProvider = llmProvider;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * Extracts entities from text
   * 
   * @param text - The text to extract entities from
   * @returns A promise that resolves to an array of extracted entities
   */
  public async extractEntities(text: string): Promise<ExtractedEntity[]> {
    try {
      const prompt = (this.options.entityExtractionPrompt || DEFAULT_ENTITY_EXTRACTION_PROMPT)
        .replace('{{text}}', text);
      
      const response = await this.llmProvider.generate(prompt);
      const entities = this.parseEntitiesResponse(response);
      
      // Filter entities by confidence threshold
      return entities
        .filter(entity => entity.confidence >= this.options.confidenceThreshold)
        .slice(0, this.options.maxEntities);
    } catch (error) {
      logger.error('Error extracting entities:', error);
      return [];
    }
  }
  
  /**
   * Extracts relations between entities from text
   * 
   * @param text - The text to extract relations from
   * @param entities - The entities to extract relations between
   * @returns A promise that resolves to an array of extracted relations
   */
  public async extractRelations(text: string, entities: ExtractedEntity[]): Promise<ExtractedRelation[]> {
    try {
      const entitiesText = entities.map(e => `- ${e.name} (${e.type})`).join('\n');
      const prompt = (this.options.relationExtractionPrompt || DEFAULT_RELATION_EXTRACTION_PROMPT)
        .replace('{{text}}', text)
        .replace('{{entities}}', entitiesText);
      
      const response = await this.llmProvider.generate(prompt);
      const relations = this.parseRelationsResponse(response, entities);
      
      // Filter relations by confidence threshold
      return relations
        .filter(relation => relation.confidence >= this.options.confidenceThreshold)
        .slice(0, this.options.maxRelations);
    } catch (error) {
      logger.error('Error extracting relations:', error);
      return [];
    }
  }
  
  /**
   * Extracts triples (SPO) from text
   * 
   * @param text - The text to extract triples from
   * @returns A promise that resolves to an array of extracted triples
   */
  public async extractTriples(text: string): Promise<Triple[]> {
    try {
      const prompt = DEFAULT_TRIPLE_EXTRACTION_PROMPT.replace('{{text}}', text);
      const response = await this.llmProvider.generate(prompt);
      const triples = this.parseTriplesResponse(response, text);
      
      // Filter triples by confidence threshold
      return triples.filter(triple => triple.confidence >= this.options.confidenceThreshold);
    } catch (error) {
      logger.error('Error extracting triples:', error);
      return [];
    }
  }
  
  /**
   * Extracts entities and relations from text and converts them to knowledge graph nodes and edges
   * 
   * @param text - The text to extract entities and relations from
   * @param sourceLocation - Optional source location of the text
   * @returns A promise that resolves to an object containing nodes and edges
   */
  public async extractToKnowledgeGraph(text: string, sourceLocation?: string): Promise<{
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  }> {
    // Extract entities
    const entities = await this.extractEntities(text);
    
    // Convert entities to knowledge graph nodes
    const nodes: KnowledgeNode[] = entities.map(entity => ({
      id: entity.id,
      type: entity.type,
      properties: {
        ...entity.properties,
        name: entity.name,
        mentions: entity.mentions,
        confidence: entity.confidence,
        sourceText: text,
        sourceLocation,
      },
      created: Date.now(),
      updated: Date.now(),
      version: 1,
    }));
    
    // Extract relations between entities
    const relations = await this.extractRelations(text, entities);
    
    // Convert relations to knowledge graph edges
    const edges: KnowledgeEdge[] = relations.map(relation => ({
      id: relation.id,
      sourceId: relation.sourceEntityId,
      targetId: relation.targetEntityId,
      type: relation.type,
      properties: {
        ...relation.properties,
        confidence: relation.confidence,
        sourceText: text,
        sourceLocation,
      },
      created: Date.now(),
      updated: Date.now(),
      version: 1,
    }));
    
    return { nodes, edges };
  }
  
  /**
   * Parses the response from the entity extraction prompt
   * 
   * @param response - The response from the LLM
   * @returns An array of extracted entities
   */
  private parseEntitiesResponse(response: string): ExtractedEntity[] {
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('No JSON array found in entity extraction response');
        return [];
      }
      
      const jsonStr = jsonMatch[0];
      const parsedEntities = JSON.parse(jsonStr);
      
      // Validate and transform entities
      return parsedEntities.map((entity: any) => ({
        id: uuidv4(),
        name: entity.name || 'Unknown Entity',
        type: entity.type || 'Unknown',
        properties: entity.properties || {},
        mentions: entity.mentions || [entity.name],
        confidence: entity.confidence || 0.5,
      }));
    } catch (error) {
      logger.error('Error parsing entity extraction response:', error);
      return [];
    }
  }
  
  /**
   * Parses the response from the relation extraction prompt
   * 
   * @param response - The response from the LLM
   * @param entities - The extracted entities
   * @returns An array of extracted relations
   */
  private parseRelationsResponse(response: string, entities: ExtractedEntity[]): ExtractedRelation[] {
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('No JSON array found in relation extraction response');
        return [];
      }
      
      const jsonStr = jsonMatch[0];
      const parsedRelations = JSON.parse(jsonStr);
      
      // Create a map of entity names to IDs for quick lookup
      const entityMap = new Map<string, string>();
      entities.forEach(entity => {
        entityMap.set(entity.name.toLowerCase(), entity.id);
        // Also map each mention to the entity ID
        entity.mentions.forEach(mention => {
          entityMap.set(mention.toLowerCase(), entity.id);
        });
      });
      
      // Validate and transform relations
      return parsedRelations
        .map((relation: any) => {
          const sourceEntityName = relation.sourceEntity?.toLowerCase();
          const targetEntityName = relation.targetEntity?.toLowerCase();
          
          // Skip relations where entities are not found
          if (!sourceEntityName || !targetEntityName) {
            return null;
          }
          
          const sourceEntityId = entityMap.get(sourceEntityName);
          const targetEntityId = entityMap.get(targetEntityName);
          
          // Skip relations where entities are not found
          if (!sourceEntityId || !targetEntityId) {
            return null;
          }
          
          return {
            id: uuidv4(),
            type: relation.type || 'Unknown',
            sourceEntityId,
            targetEntityId,
            properties: relation.properties || {},
            confidence: relation.confidence || 0.5,
          };
        })
        .filter((relation): relation is ExtractedRelation => relation !== null);
    } catch (error) {
      logger.error('Error parsing relation extraction response:', error);
      return [];
    }
  }
  
  /**
   * Parses the response from the triple extraction prompt
   * 
   * @param response - The response from the LLM
   * @param sourceText - The source text
   * @returns An array of extracted triples
   */
  private parseTriplesResponse(response: string, sourceText: string): Triple[] {
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('No JSON array found in triple extraction response');
        return [];
      }
      
      const jsonStr = jsonMatch[0];
      const parsedTriples = JSON.parse(jsonStr);
      
      // Validate and transform triples
      return parsedTriples
        .map((triple: any) => {
          // Skip incomplete triples
          if (!triple.subject || !triple.predicate || !triple.object) {
            return null;
          }
          
          return {
            subject: triple.subject,
            predicate: triple.predicate,
            object: triple.object,
            confidence: triple.confidence || 0.5,
            sourceText,
          };
        })
        .filter((triple): triple is Triple => triple !== null);
    } catch (error) {
      logger.error('Error parsing triple extraction response:', error);
      return [];
    }
  }
} 