/**
 * SearchAndSummarize Action
 * 
 * This action performs web searching and summarization of search results
 * to answer user queries with relevant information from the web.
 */

import { BaseAction } from './base-action';
import type { ActionOutput, ActionConfig } from '../types/action';
import type { Message } from '../types/message';
import { logger } from '../utils/logger';
import { SearchProviderType } from '../config/search';

/**
 * Search result format
 */
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * System prompts for different use cases
 */
export const SEARCH_AND_SUMMARIZE_SYSTEM = `### Requirements
1. Please summarize the latest dialogue based on the reference information (secondary) and dialogue history (primary). Do not include text that is irrelevant to the conversation.
- The context is for reference only. If it is irrelevant to the user's search request history, please reduce its reference and usage.
2. If there are citable links in the context, annotate them in the main text in the format [main text](citation link). If there are none in the context, do not write links.
3. The reply should be graceful, clear, non-repetitive, smoothly written, and of moderate length, in {LANG}.`;

// English version of the system prompt
export const SEARCH_AND_SUMMARIZE_SYSTEM_EN_US = SEARCH_AND_SUMMARIZE_SYSTEM.replace('{LANG}', 'en-us');

// Prompt template for search and summarize
export const SEARCH_AND_SUMMARIZE_PROMPT = `
### Reference Information
{CONTEXT}

### Dialogue History
{QUERY_HISTORY}
{QUERY}

### Current Question
{QUERY}

### Current Reply: Based on the information, please write the reply to the Question

`;

/**
 * Action for searching the web and summarizing results
 */
export class SearchAndSummarize extends BaseAction {
  // Search provider to use
  private searchProvider: SearchProviderType;
  // Last search result
  private lastSearchResult: string = '';

  constructor(config: ActionConfig) {
    super({
      ...config,
      name: config.name || 'SearchAndSummarize',
      description: config.description || 'Searches the web for information and summarizes the results',
    });
    
    // Set the search provider (default to SERPAPI if not specified)
    this.searchProvider = this.getArg<SearchProviderType>('provider') || SearchProviderType.SERPAPI;
  }

  /**
   * Runs the SearchAndSummarize action
   * @returns The summarized search results
   */
  public async run(): Promise<ActionOutput> {
    try {
      logger.info(`[${this.name}] Running SearchAndSummarize action`);
      
      // Get messages from context args
      const messages = this.getArg<Message[]>('messages') || [];
      
      if (messages.length === 0) {
        return this.createOutput(
          'No messages in context. Please provide conversation history to search and summarize.',
          'failed'
        );
      }

      // Get the query from the last message
      const lastMessage = messages[messages.length - 1];
      const query = lastMessage?.content;
      
      if (!query) {
        return this.createOutput(
          'The last message has no content. Please provide a valid query.',
          'failed'
        );
      }
      
      logger.info(`[${this.name}] Searching for: ${query.substring(0, 100)}...`);
      
      // Perform the search 
      const searchResults = await this.performSearch(query);
      
      if (!searchResults) {
        logger.warn(`[${this.name}] No search results found for query: ${query.substring(0, 50)}...`);
        return this.createOutput(
          `I couldn't find any relevant information for your query. Please try rephrasing your question or providing more details.`,
          'completed'
        );
      }
      
      this.lastSearchResult = searchResults;

      // Previous messages in the conversation (excluding the current query)
      const previousMessages = messages.slice(0, -1);
      const queryHistory = previousMessages.map((m: Message) => `${m.role}: ${m.content}`).join('\n');
      
      // Set the system prompt
      const systemMessage = this.getArg<string[]>('system_messages')?.[0] || SEARCH_AND_SUMMARIZE_SYSTEM_EN_US;
      
      // Format the prompt with search results and conversation history
      const prompt = SEARCH_AND_SUMMARIZE_PROMPT
        .replace('{CONTEXT}', searchResults)
        .replace('{QUERY_HISTORY}', queryHistory)
        .replace('{QUERY}', `${lastMessage.role}: ${query}`);
      
      // Get summarized response from LLM
      const response = await this.ask(prompt);
      
      return this.createOutput(
        response,
        'completed',
        { query, searchResults }
      );
    } catch (error) {
      logger.error(`[${this.name}] Error in SearchAndSummarize action:`, error);
      
      await this.handleException(error as Error);
      
      return this.createOutput(
        `Failed to search and summarize: ${error}`,
        'failed'
      );
    }
  }
  
  /**
   * Performs a web search for the given query
   * @param query The search query
   * @returns The search results as a string
   */
  private async performSearch(query: string): Promise<string> {
    // In a complete implementation, this would connect to a real search API
    // For now, we'll simulate search results with a mock implementation
    
    // Get optional search configuration
    const maxResults = this.getArg<number>('max_results') || 5;
    
    try {
      // For now, we'll generate a simulated search result since we don't have the search API integrated
      logger.info(`[${this.name}] Simulating search for: ${query} (${this.searchProvider})`);
      
      // In a real implementation, this would call an actual search API
      // For example: this.config.search to get search config and call the appropriate API
      
      // For now, ask the LLM to simulate search results
      const simulatedSearchPrompt = `
      You are simulating a web search engine response for the query: "${query}"
      
      Please generate ${maxResults} realistic search results that would appear for this query.
      Include a title, URL, and snippet for each result.
      
      Format each result as:
      Title: [title]
      URL: [url]
      Snippet: [brief description or excerpt]
      
      Make the results diverse and realistic, as if they came from a real search engine.
      `;
      
      const searchResponse = await this.ask(simulatedSearchPrompt);
      return searchResponse;
    } catch (error) {
      logger.error(`[${this.name}] Search error:`, error);
      throw new Error(`Failed to perform search: ${error}`);
    }
  }
  
  /**
   * Gets the last search result
   * @returns The last search result
   */
  public getLastSearchResult(): string {
    return this.lastSearchResult;
  }
} 