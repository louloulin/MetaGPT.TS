import { describe, expect, test, beforeEach, vi } from 'vitest';
import { KnowledgeGraphManager, KGMessageType } from '../../src/knowledge/distributed-kg';
import type { KnowledgeNode, KnowledgeEdge, KGMessage } from '../../src/knowledge/distributed-kg';
import { v4 as uuidv4 } from 'uuid';

describe('KnowledgeGraphManager', () => {
  let manager: KnowledgeGraphManager;

  beforeEach(() => {
    manager = new KnowledgeGraphManager();
  });

  describe('Node Operations', () => {
    test('should add a node', async () => {
      const node = {
        id: 'person1',
        type: 'Person',
        properties: {
          name: 'Alice',
          age: 30
        }
      };

      await manager.addNode(node);
      const storedNode = manager.getNode('person1');
      expect(storedNode).toBeDefined();
      expect(storedNode?.type).toBe('Person');
      expect(storedNode?.properties).toEqual(node.properties);
      expect(storedNode?.created).toBeDefined();
      expect(storedNode?.updated).toBeDefined();
      expect(storedNode?.version).toBe(1);
    });

    test('should update a node', async () => {
      const node = {
        id: 'person1',
        type: 'Person',
        properties: {
          name: 'Alice',
          age: 30
        }
      };

      await manager.addNode(node);
      
      const updateMessage: KGMessage = {
        type: KGMessageType.UPDATE_NODE,
        payload: {
          node: {
            ...node,
            properties: {
              name: 'Alice Smith',
              age: 31
            },
            created: Date.now(),
            updated: Date.now(),
            version: 2
          }
        }
      };

      await manager.processMessage(updateMessage);
      const updatedNode = manager.getNode('person1');
      expect(updatedNode?.properties.name).toBe('Alice Smith');
      expect(updatedNode?.properties.age).toBe(31);
      expect(updatedNode?.version).toBe(2);
    });

    test('should delete a node and its connected edges', async () => {
      // Add two nodes
      const node1 = {
        id: 'person1',
        type: 'Person',
        properties: { name: 'Alice' }
      };

      const node2 = {
        id: 'person2',
        type: 'Person',
        properties: { name: 'Bob' }
      };

      await manager.addNode(node1);
      await manager.addNode(node2);

      // Add an edge between them
      const edge = {
        id: 'friend1',
        sourceId: 'person1',
        targetId: 'person2',
        type: 'FRIEND_OF',
        properties: {}
      };

      await manager.addEdge(edge);

      // Delete node1
      const deleteMessage: KGMessage = {
        type: KGMessageType.DELETE_NODE,
        payload: {
          node: {
            ...node1,
            created: Date.now(),
            updated: Date.now(),
            version: 1
          }
        }
      };

      await manager.processMessage(deleteMessage);

      // Verify node and edge are deleted
      expect(manager.getNode('person1')).toBeUndefined();
      expect(manager.getEdge('friend1')).toBeUndefined();
      // Other node should still exist
      expect(manager.getNode('person2')).toBeDefined();
    });

    test('should query nodes by type', async () => {
      const nodes = [
        {
          id: 'person1',
          type: 'Person',
          properties: { name: 'Alice' }
        },
        {
          id: 'person2',
          type: 'Person',
          properties: { name: 'Bob' }
        },
        {
          id: 'company1',
          type: 'Company',
          properties: { name: 'Tech Corp' }
        }
      ];

      for (const node of nodes) {
        await manager.addNode(node);
      }

      const personNodes = manager.queryNodesByType('Person');
      expect(personNodes).toHaveLength(2);
      expect(personNodes.map(n => n.id)).toEqual(['person1', 'person2']);
    });

    test('should query nodes by property', async () => {
      const nodes = [
        {
          id: 'person1',
          type: 'Person',
          properties: { name: 'Alice', age: 30 }
        },
        {
          id: 'person2',
          type: 'Person',
          properties: { name: 'Bob', age: 25 }
        },
        {
          id: 'person3',
          type: 'Person',
          properties: { name: 'Charlie', age: 30 }
        }
      ];

      for (const node of nodes) {
        await manager.addNode(node);
      }

      const age30Nodes = manager.queryNodesByProperty(['age'], 30);
      expect(age30Nodes).toHaveLength(2);
      expect(age30Nodes.map(n => n.id)).toEqual(['person1', 'person3']);
    });
    
    test('should search nodes by text content', async () => {
      const nodes = [
        {
          id: 'project1',
          type: 'Project',
          properties: { 
            name: 'MetaGPT', 
            description: 'A distributed AI system for collaborative agents' 
          }
        },
        {
          id: 'project2',
          type: 'Project',
          properties: { 
            name: 'DataFlow', 
            description: 'Data processing pipeline framework' 
          }
        },
        {
          id: 'article1',
          type: 'Article',
          properties: { 
            title: 'Introduction to AI Agents', 
            content: 'This article discusses collaborative agent systems' 
          }
        }
      ];

      for (const node of nodes) {
        await manager.addNode(node);
      }

      const agentResults = manager.searchNodes('agent');
      expect(agentResults.length).toBeGreaterThan(0);
      expect(agentResults.some(n => n.id === 'project1')).toBeTruthy();
      expect(agentResults.some(n => n.id === 'article1')).toBeTruthy();
      
      const dataResults = manager.searchNodes('data');
      expect(dataResults.length).toBeGreaterThan(0);
      expect(dataResults.some(n => n.id === 'project2')).toBeTruthy();
    });
  });

  describe('Edge Operations', () => {
    test('should add an edge between nodes', async () => {
      // Add nodes first
      const node1 = {
        id: 'person1',
        type: 'Person',
        properties: { name: 'Alice' }
      };

      const node2 = {
        id: 'person2',
        type: 'Person',
        properties: { name: 'Bob' }
      };

      await manager.addNode(node1);
      await manager.addNode(node2);

      // Add edge
      const edge = {
        id: 'friend1',
        sourceId: 'person1',
        targetId: 'person2',
        type: 'FRIEND_OF',
        properties: {
          since: '2023'
        }
      };

      await manager.addEdge(edge);
      const storedEdge = manager.getEdge('friend1');
      expect(storedEdge).toBeDefined();
      expect(storedEdge?.type).toBe('FRIEND_OF');
      expect(storedEdge?.properties).toEqual(edge.properties);
    });

    test('should get connected nodes', async () => {
      // Add nodes
      const nodes = [
        {
          id: 'person1',
          type: 'Person',
          properties: { name: 'Alice' }
        },
        {
          id: 'person2',
          type: 'Person',
          properties: { name: 'Bob' }
        },
        {
          id: 'person3',
          type: 'Person',
          properties: { name: 'Charlie' }
        }
      ];

      for (const node of nodes) {
        await manager.addNode(node);
      }

      // Add edges
      const edges = [
        {
          id: 'friend1',
          sourceId: 'person1',
          targetId: 'person2',
          type: 'FRIEND_OF',
          properties: {}
        },
        {
          id: 'friend2',
          sourceId: 'person1',
          targetId: 'person3',
          type: 'FRIEND_OF',
          properties: {}
        }
      ];

      for (const edge of edges) {
        await manager.addEdge(edge);
      }

      const connectedNodes = manager.getConnectedNodes('person1');
      expect(connectedNodes).toHaveLength(2);
      expect(connectedNodes.map(n => n.id)).toEqual(['person2', 'person3']);
    });
    
    test('should perform complex graph traversal', async () => {
      // Create a more complex graph structure
      const nodes = [
        { id: 'person1', type: 'Person', properties: { name: 'Alice' } },
        { id: 'person2', type: 'Person', properties: { name: 'Bob' } },
        { id: 'person3', type: 'Person', properties: { name: 'Charlie' } },
        { id: 'company1', type: 'Company', properties: { name: 'TechCorp' } },
        { id: 'project1', type: 'Project', properties: { name: 'Project A' } },
        { id: 'project2', type: 'Project', properties: { name: 'Project B' } }
      ];
      
      for (const node of nodes) {
        await manager.addNode(node);
      }
      
      const edges = [
        { id: 'works_at1', sourceId: 'person1', targetId: 'company1', type: 'WORKS_AT', properties: {} },
        { id: 'works_at2', sourceId: 'person2', targetId: 'company1', type: 'WORKS_AT', properties: {} },
        { id: 'works_on1', sourceId: 'person1', targetId: 'project1', type: 'WORKS_ON', properties: {} },
        { id: 'works_on2', sourceId: 'person2', targetId: 'project1', type: 'WORKS_ON', properties: {} },
        { id: 'works_on3', sourceId: 'person3', targetId: 'project2', type: 'WORKS_ON', properties: {} },
        { id: 'manages', sourceId: 'company1', targetId: 'project1', type: 'MANAGES', properties: {} }
      ];
      
      for (const edge of edges) {
        await manager.addEdge(edge);
      }
      
      // Find company that person1 works at
      const person1Connections = manager.getConnectedNodes('person1');
      const personCompany = person1Connections.find(n => n.type === 'Company');
      expect(personCompany?.id).toBe('company1');
      
      // Find all people who work at the same company as person1
      const companyConnections = manager.getConnectedNodes('company1');
      const coworkers = companyConnections.filter(n => n.type === 'Person');
      expect(coworkers.length).toBe(2);
      expect(coworkers.map(n => n.id).sort()).toEqual(['person1', 'person2']);
      
      // Find projects the company manages
      const companyProjects = companyConnections.filter(n => n.type === 'Project');
      expect(companyProjects.length).toBe(1);
      expect(companyProjects[0].id).toBe('project1');
      
      // Find people working on the same project as person1
      const project1 = person1Connections.find(n => n.type === 'Project');
      expect(project1?.id).toBe('project1');
      
      const projectContributors = manager.getConnectedNodes('project1');
      expect(projectContributors.length).toBe(3);  // person1, person2, company1
      
      const projectPeople = projectContributors.filter(n => n.type === 'Person');
      expect(projectPeople.length).toBe(2);
      expect(projectPeople.map(n => n.id).sort()).toEqual(['person1', 'person2']);
    });
  });

  describe('Synchronization', () => {
    test('should handle sync request and response', async () => {
      const manager = new KnowledgeGraphManager();
      const manager2 = new KnowledgeGraphManager();

      // Add data to manager
      await manager.addNode({
        id: 'person1',
        type: 'Person',
        properties: { name: 'Alice' }
      });

      await manager.addNode({
        id: 'person2',
        type: 'Person',
        properties: { name: 'Bob' }
      });

      // Spy on the triggerEvent method instead of processMessage
      const triggerEventSpy = vi.spyOn(manager, 'triggerEvent' as any);

      // Create and send sync request
      const syncRequest = {
        type: KGMessageType.SYNC_REQUEST,
        payload: {}
      };

      await manager.processMessage(syncRequest);

      // Verify triggerEvent was called with sync response data
      expect(triggerEventSpy).toHaveBeenCalledWith(
        KGMessageType.SYNC_RESPONSE,
        expect.objectContaining({
          syncData: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({ id: 'person1' }),
              expect.objectContaining({ id: 'person2' })
            ])
          })
        })
      );
    });

    test('should merge data during sync response', async () => {
      const manager1 = new KnowledgeGraphManager();
      const manager2 = new KnowledgeGraphManager();

      // Add data to manager1
      await manager1.addNode({
        id: 'person1',
        type: 'Person',
        properties: { name: 'Alice' }
      });

      // Create a complete node object with all required fields
      const completeNode = {
        id: 'person1',
        type: 'Person',
        properties: { name: 'Alice' },
        created: Date.now(),
        updated: Date.now(),
        version: 1
      };

      // Create sync response message with proper node structure
      const syncResponse = {
        type: KGMessageType.SYNC_RESPONSE,
        payload: {
          syncData: {
            nodes: [completeNode],
            edges: [],
            timestamp: Date.now() + 1000 // Ensure timestamp is newer than default initialization
          }
        }
      };

      // Send sync response to manager2
      await manager2.processMessage(syncResponse);

      // Verify data was merged
      const syncedNode = manager2.getNode('person1');
      expect(syncedNode).toBeDefined();
      expect(syncedNode?.properties.name).toBe('Alice');
    });
    
    test('should resolve conflicts by using higher version', async () => {
      const manager1 = new KnowledgeGraphManager();
      const manager2 = new KnowledgeGraphManager();
      
      // Add same node to both managers
      await manager1.addNode({
        id: 'person1',
        type: 'Person',
        properties: { name: 'Alice', age: 30 }
      });
      
      await manager2.addNode({
        id: 'person1',
        type: 'Person',
        properties: { name: 'Alice', age: 30 }
      });
      
      // Update node in manager2 with a higher version
      const updateMsg = {
        type: KGMessageType.UPDATE_NODE,
        payload: {
          node: {
            id: 'person1',
            type: 'Person',
            properties: { name: 'Alice Smith', age: 31 },
            created: Date.now(),
            updated: Date.now(),
            version: 2
          }
        }
      };
      
      await manager2.processMessage(updateMsg);
      
      // Get the updated node directly from manager2
      const updatedNode = manager2.getNode('person1');
      expect(updatedNode).toBeDefined();
      
      // Create a sync response with the actual node data
      const syncResponse = {
        type: KGMessageType.SYNC_RESPONSE,
        payload: {
          syncData: {
            nodes: [updatedNode!], // Use the actual node
            edges: [],
            timestamp: Date.now()
          }
        }
      };
      
      await manager1.processMessage(syncResponse);
      
      // Verify manager1 has the updated node
      const node = manager1.getNode('person1');
      expect(node?.properties.name).toBe('Alice Smith');
      expect(node?.properties.age).toBe(31);
      expect(node?.version).toBe(2);
    });
    
    test('should not overwrite with older versions during sync', async () => {
      const manager1 = new KnowledgeGraphManager();
      const manager2 = new KnowledgeGraphManager();
      
      // Add node to manager1 with version 2
      await manager1.addNode({
        id: 'person1',
        type: 'Person',
        properties: { name: 'Alice', age: 30 }
      });
      
      const updateMsg: KGMessage = {
        type: KGMessageType.UPDATE_NODE,
        payload: {
          node: {
            id: 'person1',
            type: 'Person',
            properties: { name: 'Alice Smith', age: 31 },
            created: Date.now(),
            updated: Date.now(),
            version: 2
          }
        }
      };
      
      await manager1.processMessage(updateMsg);
      
      // Add same node to manager2 with version 1
      await manager2.addNode({
        id: 'person1',
        type: 'Person',
        properties: { name: 'Alice Johnson', age: 29 }
      });
      
      // Sync from manager2 to manager1 (with older version)
      const syncResponse: KGMessage = {
        type: KGMessageType.SYNC_RESPONSE,
        payload: {
          syncData: {
            nodes: Array.from((manager2 as any).nodes.values()),
            edges: [],
            timestamp: Date.now()
          }
        }
      };
      
      await manager1.processMessage(syncResponse);
      
      // Verify manager1 still has its version (version 2)
      const node = manager1.getNode('person1');
      expect(node?.properties.name).toBe('Alice Smith');
      expect(node?.properties.age).toBe(31);
      expect(node?.version).toBe(2);
    });
  });
  
  describe('Performance and Concurrency', () => {
    test('should handle many nodes and edges efficiently', async () => {
      // Create a larger graph
      const nodeCount = 100;
      const edgeCount = 200;
      
      // Add nodes
      for (let i = 0; i < nodeCount; i++) {
        await manager.addNode({
          id: `node${i}`,
          type: i % 3 === 0 ? 'Person' : i % 3 === 1 ? 'Company' : 'Project',
          properties: {
            name: `Entity ${i}`,
            value: i
          }
        });
      }
      
      // Add edges
      for (let i = 0; i < edgeCount; i++) {
        const sourceIdx = i % nodeCount;
        const targetIdx = (i + 1 + Math.floor(i / 10)) % nodeCount; // Ensure different from source
        
        await manager.addEdge({
          id: `edge${i}`,
          sourceId: `node${sourceIdx}`,
          targetId: `node${targetIdx}`,
          type: i % 4 === 0 ? 'CONNECTS' : i % 4 === 1 ? 'RELATES_TO' : i % 4 === 2 ? 'DEPENDS_ON' : 'REFERENCES',
          properties: {
            weight: i,
            timestamp: Date.now()
          }
        });
      }
      
      // Perform various queries to test performance
      const persons = manager.queryNodesByType('Person');
      expect(persons.length).toBeGreaterThanOrEqual(nodeCount / 3 - 1);
      
      const valueQuery = manager.queryNodesByProperty(['value'], 42);
      expect(valueQuery.length).toBeLessThanOrEqual(1);
      
      const connectedToNode10 = manager.getConnectedNodes('node10');
      expect(connectedToNode10.length).toBeGreaterThan(0);
    });
  });
}); 