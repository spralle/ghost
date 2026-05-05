import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    conditions: ["source"],
    alias: {
      // Sub-path exports must come before base aliases
      '@ghost-shell/contracts/plugin': path.resolve(__dirname, './packages/plugin-contracts/src/plugin.ts'),
      '@ghost-shell/contracts/context': path.resolve(__dirname, './packages/plugin-contracts/src/context.ts'),
      '@ghost-shell/contracts/services': path.resolve(__dirname, './packages/plugin-contracts/src/services.ts'),
      '@ghost-shell/contracts/layer': path.resolve(__dirname, './packages/plugin-contracts/src/layer.ts'),
      '@ghost-shell/contracts/theme': path.resolve(__dirname, './packages/plugin-contracts/src/theme.ts'),
      '@ghost-shell/contracts/parts': path.resolve(__dirname, './packages/plugin-contracts/src/parts.ts'),
      '@ghost-shell/contracts/schemas': path.resolve(__dirname, './packages/plugin-contracts/src/schemas.ts'),
      '@ghost-shell/contracts/capabilities': path.resolve(__dirname, './packages/plugin-contracts/src/capabilities.ts'),

      // Predicate sub-path exports
      '@ghost-shell/predicate/safe-path': path.resolve(__dirname, './packages/predicate/src/safe-path.ts'),
      '@ghost-shell/predicate/compile': path.resolve(__dirname, './packages/predicate/src/compile.ts'),

      // Base package aliases
      '@ghost-shell/arbiter': path.resolve(__dirname, './packages/arbiter/src/index.ts'),
      '@ghost-shell/bridge': path.resolve(__dirname, './packages/bridge/src/index.ts'),
      '@ghost-shell/commands': path.resolve(__dirname, './packages/commands/src/index.ts'),
      '@ghost-shell/config-plugin-runtime': path.resolve(__dirname, './packages/config-plugin-runtime/src/index.ts'),
      '@ghost-shell/contracts': path.resolve(__dirname, './packages/plugin-contracts/src/index.ts'),
      '@ghost-shell/data-table': path.resolve(__dirname, './packages/data-table/src/index.ts'),
      '@ghost-shell/entity-table': path.resolve(__dirname, './packages/entity-table/src/index.ts'),
      '@ghost-shell/federation': path.resolve(__dirname, './packages/federation/src/index.ts'),
      '@ghost-shell/formr-core': path.resolve(__dirname, './packages/formr-core/src/index.ts'),
      '@ghost-shell/formr-from-schema': path.resolve(__dirname, './packages/formr-from-schema/src/index.ts'),
      '@ghost-shell/formr-react': path.resolve(__dirname, './packages/formr-react/src/index.ts'),
      '@ghost-shell/intents': path.resolve(__dirname, './packages/intents/src/index.ts'),
      '@ghost-shell/layer': path.resolve(__dirname, './packages/layer/src/index.ts'),
      '@ghost-shell/persistence': path.resolve(__dirname, './packages/persistence/src/index.ts'),
      '@ghost-shell/plugin-system': path.resolve(__dirname, './packages/plugin-system/src/index.ts'),
      '@ghost-shell/predicate': path.resolve(__dirname, './packages/predicate/src/index.ts'),
      '@ghost-shell/react': path.resolve(__dirname, './packages/react/src/index.ts'),
      '@ghost-shell/router': path.resolve(__dirname, './packages/router/src/index.ts'),
      '@scheman/core': path.resolve(__dirname, './packages/scheman-core/src/index.ts'),
      '@ghost-shell/shell': path.resolve(__dirname, './packages/shell/src/index.ts'),
      '@ghost-shell/state': path.resolve(__dirname, './packages/state/src/index.ts'),
      '@ghost-shell/table-from-schema': path.resolve(__dirname, './packages/table-from-schema/src/index.ts'),
      '@ghost-shell/theme': path.resolve(__dirname, './packages/theme/src/index.ts'),
      '@ghost-shell/ui': path.resolve(__dirname, './packages/ui/src/index.ts'),
      '@ghost-shell/weaver-formr-bridge': path.resolve(__dirname, './packages/weaver-formr-bridge/src/index.ts'),

      // @weaver/* packages — linked from external weaver project
      '@weaver/config-engine': path.resolve(__dirname, './node_modules/@weaver/config-engine/src/index.ts'),
      '@weaver/config-types': path.resolve(__dirname, './node_modules/@weaver/config-types/src/index.ts'),
      '@weaver/config-providers': path.resolve(__dirname, './node_modules/@weaver/config-providers/src/index.ts'),
      '@weaver/config-sessions': path.resolve(__dirname, './node_modules/@weaver/config-sessions/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/src/**/*.{test,spec}.ts', 'plugins/**/src/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-test/**'],
  },
})
