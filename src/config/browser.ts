import { z } from 'zod';

/**
 * Browser type enumeration
 */
export enum BrowserType {
  PLAYWRIGHT = 'playwright',
  PUPPETEER = 'puppeteer',
  SELENIUM = 'selenium',
}

/**
 * Browser configuration schema
 */
export const BrowserConfigSchema = z.object({
  browserType: z.nativeEnum(BrowserType).default(BrowserType.PLAYWRIGHT),
  headless: z.boolean().default(true),
  timeout: z.number().default(30000),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']).default('networkidle'),
  proxy: z.string().optional(),
  userAgent: z.string().optional(),
  viewport: z.object({
    width: z.number().default(1280),
    height: z.number().default(800),
  }).optional(),
  ignoreHTTPSErrors: z.boolean().default(true),
  maxConcurrency: z.number().default(10),
  retryCount: z.number().default(3),
  downloadPath: z.string().optional(),
  extraHeaders: z.record(z.string()).default({}),
});

export type BrowserConfig = z.infer<typeof BrowserConfigSchema>; 