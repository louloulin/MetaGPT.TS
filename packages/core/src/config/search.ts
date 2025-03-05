import { z } from 'zod';

/**
 * Search provider types
 */
export enum SearchProviderType {
  SERPAPI = 'serpapi',
  GOOGLE = 'google',
  BING = 'bing',
  CUSTOM = 'custom',
}

/**
 * Search configuration schema
 */
export const SearchConfigSchema = z.object({
  provider: z.nativeEnum(SearchProviderType).default(SearchProviderType.SERPAPI),
  apiKey: z.string().default(''),
  customSearchId: z.string().optional(),
  maxResults: z.number().default(10),
  timeout: z.number().default(30),
  maxRetries: z.number().default(3),
  proxy: z.string().optional(),
  safeSearch: z.boolean().default(true),
  language: z.string().default('en'),
  region: z.string().default('us'),
  includeParams: z.record(z.any()).default({}),
});

export type SearchConfig = z.infer<typeof SearchConfigSchema>; 