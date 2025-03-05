import { z } from 'zod';

/**
 * Omniparse configuration schema for file parsing settings
 */
export const OmniParseConfigSchema = z.object({
  maxFileSize: z.number().default(10 * 1024 * 1024), // 10MB
  supportedFormats: z.array(z.string()).default([
    '.txt', '.md', '.pdf', '.doc', '.docx',
    '.xls', '.xlsx', '.csv', '.json', '.xml',
    '.html', '.htm', '.py', '.js', '.ts',
    '.jsx', '.tsx', '.java', '.cpp', '.c',
    '.h', '.cs', '.go', '.rs', '.php',
    '.rb', '.swift', '.kt', '.scala', '.sql',
  ]),
  extractImages: z.boolean().default(false),
  extractTables: z.boolean().default(true),
  preserveFormatting: z.boolean().default(true),
  chunkSize: z.number().default(1000),
  overlapSize: z.number().default(100),
  timeout: z.number().default(30),
  maxRetries: z.number().default(3),
});

export type OmniParseConfig = z.infer<typeof OmniParseConfigSchema>; 