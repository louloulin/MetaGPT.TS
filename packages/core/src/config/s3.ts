import { z } from 'zod';

/**
 * S3 provider types
 */
export enum S3ProviderType {
  AWS = 'aws',
  MINIO = 'minio',
  CUSTOM = 'custom',
}

/**
 * S3 configuration schema
 */
export const S3ConfigSchema = z.object({
  provider: z.nativeEnum(S3ProviderType).default(S3ProviderType.AWS),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  region: z.string().default('us-east-1'),
  bucket: z.string(),
  endpoint: z.string().optional(),
  forcePathStyle: z.boolean().default(false),
  sslEnabled: z.boolean().default(true),
  maxRetries: z.number().default(3),
  timeout: z.number().default(60),
  uploadOptions: z.object({
    partSize: z.number().default(5 * 1024 * 1024), // 5MB
    queueSize: z.number().default(4),
  }).default({}),
  presignedUrlExpiry: z.number().default(3600), // 1 hour
});

export type S3Config = z.infer<typeof S3ConfigSchema>; 