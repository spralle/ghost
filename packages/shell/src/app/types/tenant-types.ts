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
}

export interface TenantPluginManifestResponse {
  tenantId: string;
  plugins: TenantPluginDescriptor[];
}
