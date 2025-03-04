/**
 * RAG System Example
 * 
 * This example demonstrates how to use the Enhanced RAG system with LlamaIndex.
 */

import { EnhancedRAG } from '../src/rag/enhanced-rag';
import { OpenAIProvider } from '../src/llm/openai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  // Initialize OpenAI provider
  const openai = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-3.5-turbo',
  });

  // Create RAG system
  const rag = new EnhancedRAG(openai, {
    topK: 3,
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  // Add some sample documents
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
      metadata: { source: 'typescript-docs', category: 'programming' }
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
      metadata: { source: 'javascript-docs', category: 'programming' }
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
      metadata: { source: 'python-docs', category: 'programming' }
    }
  ];

  console.log('Adding documents to RAG system...');
  const docIds = await rag.addDocuments(docs);
  console.log(`Added ${docIds.length} documents with IDs:`, docIds);

  // Example queries
  const queries = [
    'What are the key features of TypeScript?',
    'How does JavaScript compare to TypeScript?',
    'Tell me about Python and its features',
  ];

  // Run queries
  for (const query of queries) {
    console.log('\n-----------------------------------');
    console.log(`Query: ${query}`);
    console.log('-----------------------------------');
    
    const result = await rag.generateWithResults(query);
    
    console.log('\nRetrieved Documents:');
    result.searchResults.forEach((doc, i) => {
      console.log(`\n[${i+1}] Score: ${doc.score.toFixed(4)}`);
      console.log(`Source: ${doc.metadata.source || 'unknown'}`);
      console.log(`Content: ${doc.chunk.content.substring(0, 150)}...`);
    });
    
    console.log('\nGenerated Response:');
    console.log(result.response);
  }
}

// Run the example
main().catch(error => {
  console.error('Error running RAG example:', error);
}); 