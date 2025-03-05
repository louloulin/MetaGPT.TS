/**
 * RAG System Example with Metadata Filtering
 * 
 * This example demonstrates how to use metadata filtering with the CustomRAG system
 * to get more targeted results from your knowledge base.
 * 
 * Key features demonstrated:
 * 1. Creating a CustomRAG instance with a custom LLM provider
 * 2. Adding documents with rich metadata
 * 3. Performing basic RAG queries without filtering
 * 4. Using metadata filters to target specific document subsets
 * 5. Comparing results with and without filtering
 * 
 * Usage:
 * $ bun run examples/metadata-filtering-example.ts
 * 
 * Note: This example uses the CustomRAG implementation that doesn't require
 * an OpenAI API key, making it suitable for environments without access to
 * external API services.
 */

import { CustomRAG } from '../src/rag/custom-rag';
import { createLLMProvider } from './llm-provider';

async function main() {
  // Create a custom RAG system with a custom system prompt
  const llmProvider = createLLMProvider('你是一位RAG助手，擅长根据用户的问题，从知识库中检索相关信息，并给出回答。');
  const rag = new CustomRAG(llmProvider, {
    topK: 3  // Retrieve top 3 most relevant documents
  });

  // Add documents with rich metadata
  // Each document has language and level metadata that can be used for filtering
  const docs = [
    {
      content: `TypeScript is a strongly typed programming language that builds on JavaScript, 
      giving you better tooling at any scale. It adds static type definitions to JavaScript, 
      which helps catch errors early and makes code more maintainable.
      
      Key Features: Static typing, Type inference, Type erasure, Interfaces, Generics, Namespaces, Decorators`,
      metadata: { language: 'typescript', level: 'beginner' }
    },
    {
      content: `JavaScript is a lightweight, interpreted, or just-in-time compiled programming language 
      with first-class functions. While it is most well-known as the scripting language for Web pages, 
      many non-browser environments also use it, such as Node.js.
      
      Key Features: Dynamic typing, Prototype-based object-orientation, First-class functions,
      Event-driven programming, Single-threaded with event loop`,
      metadata: { language: 'javascript', level: 'beginner' }
    },
    {
      content: `In large-scale enterprise applications, TypeScript provides significant benefits:
      
      Enterprise Benefits: Enhanced type safety for complex systems, Better refactoring support 
      across large codebases, Improved IDE integration for large teams, Advanced static analysis tools,
      Integration with build pipelines and CI/CD systems, Gradual adoption strategies for legacy JavaScript projects`,
      metadata: { language: 'typescript', level: 'advanced' }
    }
  ];

  console.log('Adding documents to RAG system...');
  const docIds = await rag.addDocuments(docs);
  console.log(`Added ${docIds.length} documents with IDs:`, docIds);

  // Example 1: Basic query without filtering
  // This will retrieve all relevant documents regardless of metadata
  console.log('\n====== Query without filtering ======');
  console.log('Query: What are the key features of TypeScript?');
  
  const result1 = await rag.generateWithResults('What are the key features of TypeScript?');
  
  console.log('\nRetrieved Documents:');
  result1.searchResults.forEach((doc, i) => {
    console.log(`\n[${i+1}] Score: ${doc.score.toFixed(4)}`);
    console.log(`Language: ${doc.metadata.language}`);
    console.log(`Level: ${doc.metadata.level}`);
    console.log(`Content: ${doc.chunk.content.substring(0, 100)}...`);
  });
  
  console.log('\nGenerated Response:');
  console.log(result1.response);

  // Example 2: Query with beginner level filter
  // This demonstrates how to filter documents by metadata
  // Only documents with level='beginner' will be used for generation
  console.log('\n====== Query with beginner level filter ======');
  console.log('Query: What are the key features of TypeScript? (beginner level)');
  
  const result2 = await rag.generateWithResults('What are the key features of TypeScript?', {
    filter: (doc) => doc.metadata.level === 'beginner'
  });
  
  console.log('\nRetrieved Documents (filtered to beginner level):');
  result2.searchResults.forEach((doc, i) => {
    console.log(`\n[${i+1}] Score: ${doc.score.toFixed(4)}`);
    console.log(`Language: ${doc.metadata.language}`);
    console.log(`Level: ${doc.metadata.level}`);
    console.log(`Content: ${doc.chunk.content.substring(0, 100)}...`);
  });
  
  console.log('\nGenerated Response:');
  console.log(result2.response);

  // Example 3: Query with advanced level filter
  // This demonstrates how to target advanced content specifically
  // The query is also crafted to be more relevant to advanced topics
  console.log('\n====== Query with advanced level filter ======');
  console.log('Query: What are the features of TypeScript for enterprise development?');
  
  const result3 = await rag.generateWithResults('What are the features of TypeScript for enterprise development?', {
    filter: (doc) => doc.metadata.level === 'advanced'
  });
  
  console.log('\nRetrieved Documents (filtered to advanced level):');
  result3.searchResults.forEach((doc, i) => {
    console.log(`\n[${i+1}] Score: ${doc.score.toFixed(4)}`);
    console.log(`Language: ${doc.metadata.language}`);
    console.log(`Level: ${doc.metadata.level}`);
    console.log(`Content: ${doc.chunk.content.substring(0, 100)}...`);
  });
  
  console.log('\nGenerated Response:');
  console.log(result3.response);
}

// Run the example
main().catch(error => {
  console.error('Error running RAG example with metadata filtering:', error);
}); 