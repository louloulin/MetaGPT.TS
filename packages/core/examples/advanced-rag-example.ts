/**
 * Advanced RAG System Example with Metadata Filtering
 * 
 * This example demonstrates the power of CustomRAG with advanced metadata filtering,
 * allowing for precise targeting of knowledge subsets for more accurate and relevant responses.
 * 
 * Key features demonstrated:
 * 1. Creating a CustomRAG instance with flexible configuration
 * 2. Adding documents with rich, multi-dimensional metadata
 * 3. Performing basic retrieval across all documents
 * 4. Using metadata filters for targeted document retrieval (beginner vs advanced)
 * 5. Comparing content across multiple domains (programming languages)
 * 
 * Usage:
 * $ bun run examples/advanced-rag-example.ts
 * 
 * Note: The CustomRAG implementation requires no external API keys, making it
 * perfect for deployment in environments without access to commercial APIs.
 */

import { CustomRAG } from '../src/rag/custom-rag';
import { createLLMProvider } from './llm-provider';

async function main() {
  // Initialize LLM provider
  const llmProvider = createLLMProvider(
    '你是一位rag助手，擅长根据用户的问题，从知识库中检索相关信息，并给出回答。'
  );

  // Create RAG system with configuration options
  const rag = new CustomRAG(llmProvider, {
    topK: 3  // Limit results to top 3 most relevant documents
  });

  // Add documents with multi-dimensional metadata
  // Each document has source, category, level, and language metadata
  // This rich metadata enables precise filtering later on
  const docs = [
    {
      content: `
        # TypeScript
        
        TypeScript is a strongly typed programming language that builds on JavaScript, 
        giving you better tooling at any scale. It adds static type definitions to JavaScript, 
        which helps catch errors early and makes code more maintainable.
        
        ## Key Features
        
        - Static typing
        - Type inference
        - Type erasure
        - Interfaces
        - Generics
        - Namespaces
        - Decorators
      `,
      metadata: { 
        source: 'typescript-docs', 
        category: 'programming', 
        level: 'beginner',
        language: 'typescript'
      }
    },
    {
      content: `
        # JavaScript
        
        JavaScript is a lightweight, interpreted, or just-in-time compiled programming language 
        with first-class functions. While it is most well-known as the scripting language for Web pages, 
        many non-browser environments also use it, such as Node.js.
        
        ## Key Features
        
        - Dynamic typing
        - Prototype-based object-orientation
        - First-class functions
        - Event-driven programming
        - Single-threaded with event loop
      `,
      metadata: { 
        source: 'javascript-docs', 
        category: 'programming',
        level: 'beginner',
        language: 'javascript'
      }
    },
    {
      content: `
        # Python
        
        Python is an interpreted, high-level, general-purpose programming language. 
        Its design philosophy emphasizes code readability with its use of significant whitespace.
        
        ## Key Features
        
        - Dynamic typing
        - Interpreted language
        - Comprehensive standard library
        - Extensive third-party packages
        - Multi-paradigm: procedural, object-oriented, functional
      `,
      metadata: { 
        source: 'python-docs', 
        category: 'programming',
        level: 'beginner',
        language: 'python'
      }
    },
    {
      content: `
        # TypeScript for Enterprise Development
        
        In large-scale enterprise applications, TypeScript provides significant benefits:
        
        ## Enterprise Benefits
        
        - Enhanced type safety for complex systems
        - Better refactoring support across large codebases
        - Improved IDE integration for large teams
        - Advanced static analysis tools
        - Integration with build pipelines and CI/CD systems
        - Gradual adoption strategies for legacy JavaScript projects
        - Performance optimization techniques
      `,
      metadata: { 
        source: 'typescript-enterprise-guide', 
        category: 'programming',
        level: 'advanced',
        language: 'typescript'
      }
    }
  ];

  console.log('Adding documents to RAG system...');
  const docIds = await rag.addDocuments(docs);
  console.log(`Added ${docIds.length} documents with IDs:`, docIds);

  // Example 1: Basic query without filtering
  // This retrieves relevant documents regardless of their metadata
  console.log('\n====== Query without filtering ======');
  console.log('Query: What are the key features of TypeScript?');
  
  let result = await rag.generateWithResults('What are the key features of TypeScript?');
  
  console.log('\nRetrieved Documents:');
  result.searchResults.forEach((doc, i) => {
    console.log(`\n[${i+1}] Score: ${doc.score.toFixed(4)}`);
    console.log(`Source: ${doc.metadata.source}`);
    console.log(`Category: ${doc.metadata.category}`);
    console.log(`Level: ${doc.metadata.level}`);
    console.log(`Content: ${doc.chunk.content.substring(0, 100)}...`);
  });
  
  console.log('\nGenerated Response:');
  console.log(result.response);

  // Example 2: Query with beginner level filter
  // Only documents with 'beginner' level will be considered
  console.log('\n====== Query with beginner level filter ======');
  console.log('Query: What are the key features of TypeScript? (beginner level)');
  
  result = await rag.generateWithResults('What are the key features of TypeScript?', {
    filter: (doc) => doc.metadata.level === 'beginner'
  });
  
  console.log('\nRetrieved Documents:');
  result.searchResults.forEach((doc, i) => {
    console.log(`\n[${i+1}] Score: ${doc.score.toFixed(4)}`);
    console.log(`Source: ${doc.metadata.source}`);
    console.log(`Category: ${doc.metadata.category}`);
    console.log(`Level: ${doc.metadata.level}`);
    console.log(`Content: ${doc.chunk.content.substring(0, 100)}...`);
  });
  
  console.log('\nGenerated Response:');
  console.log(result.response);

  // Example 3: Query with advanced level filter
  // Focus on advanced/enterprise TypeScript content
  console.log('\n====== Query with advanced level filter ======');
  console.log('Query: What are the key features of TypeScript? (advanced level)');
  
  result = await rag.generateWithResults('What are the key features of TypeScript?', {
    filter: (doc) => doc.metadata.level === 'advanced'
  });
  
  console.log('\nRetrieved Documents:');
  result.searchResults.forEach((doc, i) => {
    console.log(`\n[${i+1}] Score: ${doc.score.toFixed(4)}`);
    console.log(`Source: ${doc.metadata.source}`);
    console.log(`Category: ${doc.metadata.category}`);
    console.log(`Level: ${doc.metadata.level}`);
    console.log(`Content: ${doc.chunk.content.substring(0, 100)}...`);
  });
  
  console.log('\nGenerated Response:');
  console.log(result.response);

  // Example 4: Comparing multiple programming languages
  // Demonstrates how RAG can synthesize information across multiple documents
  console.log('\n====== Comparing programming languages ======');
  console.log('Query: Compare TypeScript, JavaScript, and Python');
  
  result = await rag.generateWithResults('Compare TypeScript, JavaScript, and Python');
  
  console.log('\nRetrieved Documents:');
  result.searchResults.forEach((doc, i) => {
    console.log(`\n[${i+1}] Score: ${doc.score.toFixed(4)}`);
    console.log(`Source: ${doc.metadata.source}`);
    console.log(`Language: ${doc.metadata.language}`);
    console.log(`Content: ${doc.chunk.content.substring(0, 100)}...`);
  });
  
  console.log('\nGenerated Response:');
  console.log(result.response);
}

// Run the example
main().catch(error => {
  console.error('Error running RAG example with metadata filtering:', error);
}); 