// plugin-settings-editor.tsx — Per-plugin settings editor using SchemaForm.

import type { PluginMountContext } from "@ghost-shell/contracts";
import { CONFIG_SERVICE_ID, type ConfigurationService } from "@ghost-shell/contracts";
import { useService } from "@ghost-shell/react";
import type { JsonSchema } from "@ghost-shell/schema-core";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, SchemaForm } from "@ghost-shell/ui";
import { useCallback, useMemo } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitialData(
  schema: JsonSchema,
  service: ConfigurationService,
  pluginId: string,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const props = schema.properties;
  if (!props) return data;

  for (const key of Object.keys(props)) {
    const fullKey = `${pluginId}.${key}`;
    const stored = service.get(fullKey);
    if (stored !== undefined) {
      data[key] = stored;
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

const EMPTY_SCHEMA_PLACEHOLDER = (
  <Card>
    <CardContent className="p-6" role="status">
      <p className="text-sm text-muted-foreground">No settings schema provided.</p>
    </CardContent>
  </Card>
);

export function PluginSettingsEditor({ context }: { readonly context: PluginMountContext }) {
  const configService = useService<ConfigurationService>(CONFIG_SERVICE_ID);
  const pluginId = context.args.pluginId ?? context.part.id;
  const editingLayer = context.args.layer ?? "user";
  const schema = context.args.schema as unknown as JsonSchema | undefined;

  if (!configService) {
    return (
      <Card>
        <CardContent className="p-6" role="status">
          <p className="text-sm text-muted-foreground">No configuration service available.</p>
          <p className="text-sm text-muted-foreground">
            The settings editor requires the ConfigurationService to be registered.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!schema) {
    return EMPTY_SCHEMA_PLACEHOLDER;
  }

  const initialData = useMemo(
    () => buildInitialData(schema, configService, pluginId),
    [schema, configService, pluginId],
  );

  const handleSubmit = useCallback(
    async (data: unknown) => {
      const record = data as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        configService.set(`${pluginId}.${key}`, value, editingLayer);
      }
    },
    [configService, pluginId, editingLayer],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Settings: {pluginId}</CardTitle>
        <Badge variant="outline" className="w-fit">
          Layer: {editingLayer}
        </Badge>
      </CardHeader>
      <CardContent>
        <SchemaForm schema={schema} initialData={initialData} onSubmit={handleSubmit}>
          <Button type="submit" size="sm" className="mt-3">
            Save Settings
          </Button>
        </SchemaForm>
      </CardContent>
    </Card>
  );
}
