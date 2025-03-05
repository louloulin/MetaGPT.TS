/**
 * @module Config
 * @category Core
 */

import { z } from 'zod';

/**
 * Workspace configuration schema
 */
export const WorkspaceConfigSchema = z.object({
  root: z.string().default('./workspace'),
  autoClean: z.boolean().default(false),
  storagePath: z.string().default('./storage'),
});

/**
 * Workspace configuration type
 */
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>; 