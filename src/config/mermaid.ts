import { z } from 'zod';

/**
 * Mermaid theme types
 */
export enum MermaidTheme {
  DEFAULT = 'default',
  FOREST = 'forest',
  DARK = 'dark',
  NEUTRAL = 'neutral',
}

/**
 * Mermaid configuration schema
 */
export const MermaidConfigSchema = z.object({
  theme: z.nativeEnum(MermaidTheme).default(MermaidTheme.DEFAULT),
  startOnLoad: z.boolean().default(true),
  securityLevel: z.enum(['strict', 'loose', 'antiscript']).default('strict'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  arrowMarkerAbsolute: z.boolean().default(false),
  flowchart: z.object({
    htmlLabels: z.boolean().default(true),
    curve: z.enum(['basis', 'linear', 'cardinal']).default('linear'),
  }).default({}),
  sequence: z.object({
    diagramMarginX: z.number().default(50),
    diagramMarginY: z.number().default(10),
    actorMargin: z.number().default(50),
    width: z.number().default(150),
    height: z.number().default(65),
  }).default({}),
  fontSize: z.number().default(16),
  fontFamily: z.string().default('trebuchet ms'),
});

export type MermaidConfig = z.infer<typeof MermaidConfigSchema>; 