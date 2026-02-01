#!/usr/bin/env node
/**
 * OpenClaw Startup Configuration Script for Unraid
 *
 * This script runs before OpenClaw starts and:
 * 1. Preserves existing user configuration
 * 2. Ensures required gateway settings are present
 * 3. Automatically configures Ollama if environment variables are set
 *
 * Environment Variables:
 *   OLLAMA_BASE_URL      - Ollama server URL (e.g., http://172.17.0.1:11434/v1)
 *   OLLAMA_API_KEY       - Any value to enable Ollama (e.g., "ollama-local")
 *   OLLAMA_MODEL         - Default model name (e.g., "qwen2.5-coder:32b")
 *   OLLAMA_CONTEXT_WINDOW - Context window size (default: 32768)
 */

const fs = require('fs');
const path = require('path');

// Use TEST_CONFIG_DIR for local testing, otherwise use the container path
const CONFIG_DIR = process.env.TEST_CONFIG_DIR || '/root/.openclaw';
const CONFIG_FILE = path.join(CONFIG_DIR, 'openclaw.json');

// Deep merge utility - merges source into target without overwriting existing values
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else if (target[key] === undefined) {
      // Only set if not already defined (preserve user settings)
      target[key] = source[key];
    }
  }
  return target;
}

// Force merge - overwrites existing values (for required settings)
function forceMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      forceMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function main() {
  console.log('🦞 OpenClaw Startup Configuration');
  console.log('==================================\n');

  // Ensure config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    console.log(`📁 Creating config directory: ${CONFIG_DIR}`);
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Load existing config or start fresh
  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const existing = fs.readFileSync(CONFIG_FILE, 'utf8');
      config = JSON.parse(existing);
      console.log('✅ Loaded existing configuration');
    } catch (err) {
      console.log('⚠️  Could not parse existing config, starting fresh');
      config = {};
    }
  } else {
    console.log('📝 No existing config found, creating new one');
  }

  // Required gateway settings (always applied)
  const gatewayDefaults = {
    gateway: {
      mode: 'local',
      bind: 'lan',
      controlUi: {
        allowInsecureAuth: true
      },
      auth: {
        mode: 'token'
      }
    }
  };

  // Default agent settings with tools enabled
  const agentDefaults = {
    agents: {
      defaults: {
        tools: {
          profile: 'standard',
          allow: ['read', 'write', 'edit', 'exec', 'web', 'browser'],
          exec: {
            host: 'gateway',
            ask: 'off',
            security: 'standard'
          }
        }
      }
    }
  };

  // Apply gateway defaults (force these settings)
  forceMerge(config, gatewayDefaults);
  console.log('✅ Gateway settings configured');

  // Apply agent defaults (tools, permissions) - use deepMerge to preserve user customizations
  deepMerge(config, agentDefaults);
  console.log('✅ Agent tools configured');

  // Check for Ollama configuration
  const ollamaUrl = process.env.OLLAMA_BASE_URL;
  const ollamaKey = process.env.OLLAMA_API_KEY;
  const ollamaModel = process.env.OLLAMA_MODEL;
  const contextWindow = parseInt(process.env.OLLAMA_CONTEXT_WINDOW) || 32768;

  if (ollamaUrl && ollamaKey) {
    console.log('\n🦙 Configuring Ollama integration...');
    console.log(`   URL: ${ollamaUrl}`);
    console.log(`   Model: ${ollamaModel || '(user will select in UI)'}`);
    console.log(`   Context Window: ${contextWindow}`);

    // Ensure models.providers exists
    if (!config.models) config.models = {};
    if (!config.models.providers) config.models.providers = {};

    // Configure Ollama provider
    config.models.providers.ollama = {
      baseUrl: ollamaUrl,
      apiKey: ollamaKey,
      api: 'openai-completions',  // CRITICAL: must be this, not 'openai-responses'
      authHeader: false,
      ...(config.models.providers.ollama || {})  // Preserve any existing ollama customizations
    };

    // Add model definition if model is specified
    if (ollamaModel) {
      // Check if models array exists and if this model is already defined
      const existingModels = config.models.providers.ollama.models || [];
      const modelExists = existingModels.some(m => m.id === ollamaModel);

      if (!modelExists) {
        config.models.providers.ollama.models = [
          ...existingModels,
          {
            id: ollamaModel,
            name: `Ollama - ${ollamaModel}`,
            reasoning: false,
            input: ['text'],
            cost: { input: 0, output: 0 },
            contextWindow: contextWindow,
            maxTokens: Math.min(8192, Math.floor(contextWindow / 4))
          }
        ];
      }

      // Always set the model from env var (env var takes priority)
      if (!config.agents) config.agents = {};
      if (!config.agents.defaults) config.agents.defaults = {};

      const newModel = `ollama/${ollamaModel}`;
      const currentModel = config.agents.defaults.model?.primary;

      if (currentModel !== newModel) {
        config.agents.defaults.model = {
          primary: newModel
        };
        if (currentModel) {
          console.log(`   Updated default model: ${currentModel} → ${newModel}`);
        } else {
          console.log(`   Set as default model: ${newModel}`);
        }
      }
    }

    console.log('✅ Ollama configured successfully');
  } else if (ollamaUrl || ollamaKey) {
    console.log('\n⚠️  Ollama partially configured:');
    if (!ollamaUrl) console.log('   Missing: OLLAMA_BASE_URL');
    if (!ollamaKey) console.log('   Missing: OLLAMA_API_KEY');
    console.log('   Set both to enable Ollama integration');
  } else {
    console.log('\n📝 Ollama not configured (set OLLAMA_BASE_URL and OLLAMA_API_KEY to enable)');
  }

  // Write the merged configuration
  const output = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_FILE, output, 'utf8');
  console.log(`\n💾 Configuration saved to ${CONFIG_FILE}`);

  // Summary
  console.log('\n📊 Configuration Summary:');
  console.log('─'.repeat(40));

  const providers = Object.keys(config.models?.providers || {});
  if (providers.length > 0) {
    console.log(`   Providers: ${providers.join(', ')}`);
  }

  const defaultModel = config.agents?.defaults?.model?.primary;
  if (defaultModel) {
    console.log(`   Default Model: ${defaultModel}`);
  }

  console.log('─'.repeat(40));
  console.log('\n🚀 Starting OpenClaw...\n');
}

// Run
try {
  main();
} catch (err) {
  console.error('❌ Startup configuration error:', err.message);
  console.error('   Continuing with existing/default configuration...');
  process.exit(0);  // Don't block startup on config errors
}
