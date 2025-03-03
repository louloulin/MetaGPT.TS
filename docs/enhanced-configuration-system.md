# Enhanced Configuration System

This document provides an overview of the new enhanced configuration system in MetaGPT TypeScript. The system is designed to be more flexible, modular, and extensible than the previous configuration approach.

## Overview

The enhanced configuration system consists of three main components:

1. **ConfigRegistry**: A singleton registry that stores schema definitions and configuration values.
2. **EnhancedConfigManager**: A manager that handles registration of configuration sections, loading from various sources, and provides access to configuration values.
3. **PluginConfigManager**: A manager that handles plugin registration and configuration.

## Features

- **Schema-based validation** using Zod
- **Multiple configuration sources** with priority ordering
- **Modular configuration sections**
- **Plugin system** with dedicated configuration handling
- **Environment variable support** with automatic mapping
- **Configuration file support** (JSON, YAML, JS)
- **Dynamic configuration updates**

## Usage

### Basic Configuration

```typescript
import { z } from 'zod';
import { getEnhancedConfigManager, ConfigSource } from '../src/config/enhanced-config-manager';

// Get the configuration manager
const configManager = getEnhancedConfigManager();

// Define a schema for a configuration section
const DatabaseConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().positive().default(5432),
  username: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  ssl: z.boolean().default(false),
});

// Register the schema with default values
configManager.registerSection('database', DatabaseConfigSchema, {
  host: 'localhost',
  port: 5432,
  username: 'default-user',
  password: 'default-password',
  database: 'default-db',
  ssl: false,
});

// Load configuration from various sources
await configManager.load({
  configPath: './config.json', // Load from file
  loadEnv: true,               // Load from environment variables
  defaultConfig: {},           // Additional default values
  cliConfig: {},               // Command line arguments
  sourcePriority: [            // Source priority order
    ConfigSource.CLI,
    ConfigSource.ENV,
    ConfigSource.FILE,
    ConfigSource.DEFAULT,
  ],
});

// Access configuration
const dbConfig = configManager.getSection<DatabaseConfig>('database');
console.log(`Database connection: ${dbConfig.host}:${dbConfig.port}`);

// Update configuration
configManager.updateSection('database', {
  host: 'new-host',
  port: 5433,
}, ConfigSource.CLI);
```

### Plugin Configuration

```typescript
import { z } from 'zod';
import { getPluginConfigManager } from '../src/config/plugin-config';
import type { PluginBaseConfig } from '../src/config/plugin-config';

// Define a plugin schema
const SearchPluginSchema = z.object({
  engine: z.enum(['google', 'bing', 'duckduckgo']).default('google'),
  maxResults: z.number().int().positive().default(10),
  safeSearch: z.boolean().default(true),
});

// Create a type that includes the base plugin properties
type SearchPluginConfig = z.infer<typeof SearchPluginSchema> & PluginBaseConfig;

// Get the plugin manager
const pluginManager = getPluginConfigManager();

// Register a plugin
pluginManager.registerPlugin({
  metadata: {
    name: 'search',
    version: '1.0.0',
    description: 'Search plugin for MetaGPT',
    author: 'MetaGPT Team',
  },
  configSchema: SearchPluginSchema,
  defaultConfig: {
    // Base plugin config
    enabled: true,
    priority: 100,
    // Search specific config
    engine: 'google',
    maxResults: 10,
    safeSearch: true,
  } as SearchPluginConfig,
});

// Access plugin configuration
const searchConfig = pluginManager.getPluginConfig<SearchPluginConfig>('search');
console.log(`Search engine: ${searchConfig?.engine}`);

// Update plugin configuration
pluginManager.updatePluginConfig<SearchPluginConfig>('search', {
  engine: 'bing',
  maxResults: 20,
});

// Enable or disable plugins
pluginManager.disablePlugin('search');
pluginManager.enablePlugin('search');

// Check if a plugin is enabled
const isEnabled = pluginManager.isPluginEnabled('search');
```

## Configuration Sources

The system supports loading configuration from multiple sources with priority ordering:

1. **CLI Arguments**: Highest priority, provided during runtime
2. **Environment Variables**: System environment variables
3. **Configuration Files**: JSON, YAML, or JS files
4. **Default Values**: Lowest priority, defined during schema registration

Environment variables are automatically mapped to configuration paths using the following pattern:

- `METAGPT_DATABASE_HOST` → `database.host`
- `METAGPT_LLM_API_KEY` → `llm.apiKey`
- `METAGPT_PLUGIN_SEARCH_ENABLED` → `plugin.search.enabled`

## Full Example

For a complete example of using the enhanced configuration system, see the [enhanced-config-example.ts](../examples/enhanced-config-example.ts) file.

## Testing

The configuration system includes comprehensive tests to ensure its functionality:

- `enhanced-config-manager.test.ts`: Tests for the EnhancedConfigManager class
- `plugin-config-manager.test.ts`: Tests for the PluginConfigManager class

To run the tests:

```bash
npm run test
```

## Migrating from the Old Configuration System

If you're migrating from the old configuration system, here are the key differences:

1. Configuration is now schema-based with Zod validation
2. Configuration is split into modular sections
3. Plugin configuration is handled separately
4. Multiple configuration sources are supported with explicit priority

To migrate:

1. Define schemas for your configuration sections
2. Register the schemas with the EnhancedConfigManager
3. Update your code to use getSection() instead of direct property access
4. If using plugins, register them with the PluginConfigManager 