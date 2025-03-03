/**
 * Example demonstrating the usage of the distributed knowledge graph system with indexing
 */

import { KnowledgeGraphManager } from '../src/knowledge/distributed-kg';

async function main() {
  // Create two knowledge graph managers to simulate distributed nodes
  const node1 = new KnowledgeGraphManager();
  const node2 = new KnowledgeGraphManager();

  // Start both nodes
  await node1.start();
  await node2.start();

  // Add some nodes to node1
  await node1.addNode({
    id: 'person1',
    type: 'Person',
    properties: {
      name: 'Alice',
      age: 30,
      occupation: 'Engineer',
      skills: ['TypeScript', 'React', 'Node.js'],
    },
  });

  await node1.addNode({
    id: 'person2',
    type: 'Person',
    properties: {
      name: 'Bob',
      age: 28,
      occupation: 'Designer',
      skills: ['UI/UX', 'Figma', 'Sketch'],
    },
  });

  // Add some nodes to node2
  await node2.addNode({
    id: 'company1',
    type: 'Company',
    properties: {
      name: 'Tech Corp',
      industry: 'Technology',
      location: 'San Francisco',
      founded: 2010,
    },
  });

  await node2.addNode({
    id: 'project1',
    type: 'Project',
    properties: {
      name: 'MetaGPT',
      status: 'Active',
      technology: 'TypeScript',
      description: 'A distributed AI system',
    },
  });

  // Add relationships
  await node1.addEdge({
    id: 'works_at_1',
    source: 'person1',
    target: 'company1',
    type: 'WORKS_AT',
    properties: {
      role: 'Software Engineer',
      startDate: '2022-01-01',
    },
  });

  await node1.addEdge({
    id: 'works_on_1',
    source: 'person1',
    target: 'project1',
    type: 'WORKS_ON',
    properties: {
      role: 'Lead Developer',
      startDate: '2023-01-01',
    },
  });

  await node1.addEdge({
    id: 'knows_1',
    source: 'person1',
    target: 'person2',
    type: 'KNOWS',
    properties: {
      since: '2021-03-15',
      relationship: 'Colleague',
    },
  });

  // Synchronize the nodes
  await node1.requestSync();
  await node2.requestSync();

  // Query examples
  console.log('\nQuerying by type:');
  console.log('Persons:', node1.queryNodesByType('Person'));
  console.log('Companies:', node2.queryNodesByType('Company'));

  console.log('\nQuerying by property:');
  console.log('Engineers:', node1.queryNodesByProperty(['occupation'], 'Engineer'));
  console.log('TypeScript projects:', node2.queryNodesByProperty(['technology'], 'TypeScript'));

  console.log('\nText search:');
  console.log('Search "TypeScript":', node1.searchNodes('TypeScript'));
  console.log('Search "distributed":', node2.searchNodes('distributed'));

  console.log('\nGraph traversal:');
  console.log('Person1 connections:', node1.getConnectedNodes('person1'));
  console.log('Company1 connections:', node2.getConnectedNodes('company1'));

  // Stop both nodes
  await node1.stop();
  await node2.stop();
}

main().catch(console.error); 