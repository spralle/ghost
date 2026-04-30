import type { PluginContributions } from "@ghost-shell/contracts";

export interface TenantPluginDescriptor {
  id: string;
  version: string;
  entry: string;
  compatibility: {
    shell: string;
    pluginContract: string;
  };
  pluginDependencies?: string[];
  activationEvents?: string[];
  contributes?: PluginContributions;
}

export interface TenantPluginManifestResponse {
  tenantId: string;
  plugins: TenantPluginDescriptor[];
}
