// plugin-settings-editor.tsx — Per-plugin settings editor with governance chrome.
//
// Composes the full weaver-formr pipeline:
// 1. Schema middleware (x-weaver → x-formr)
// 2. Layout middleware (governance field wrappers)
// 3. Governance rules (arbiter production rules)
// 4. Renders via SchemaForm with GovernanceFieldRenderer

import type { PluginMountContext } from "@ghost-shell/contracts";
import { CONFIG_SERVICE_ID, type ConfigurationService } from "@ghost-shell/contracts";
import type { ProductionRule } from "@ghost-shell/formr-core";
import { createSchemaForm } from "@ghost-shell/formr-from-schema";
import type { LayoutRendererProps, NodeRenderer } from "@ghost-shell/formr-react";
import {
  pruneHiddenFields,
  RendererRegistry,
  renderLayoutTree,
  resolveFieldStates,
  useForm,
  useFormSelector,
} from "@ghost-shell/formr-react";
import { useService } from "@ghost-shell/react";
import type { JsonSchema } from "@ghost-shell/schema-core";
import { applySchemaMiddleware } from "@ghost-shell/schema-core";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@ghost-shell/ui";
import type { GovernanceRuleContext, WeaverFormrContext, WeaverSchemaEntry } from "@ghost-shell/weaver-formr-bridge";
import {
  buildGovernanceRules,
  createGovernanceMiddleware,
  GovernanceFieldRenderer,
  weaverToFormrMiddleware,
} from "@ghost-shell/weaver-formr-bridge";
import { useCallback, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PluginSettingsEditorInternalProps {
  readonly pluginId: string;
  readonly editingLayer: string;
  readonly schema: JsonSchema;
  readonly configService: ConfigurationService;
  readonly layerRanks?: ReadonlyMap<string, number> | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fallback layer ranking when caller doesn't provide one.
 *  Production callers should inject the actual layer stack from weaver's configuration. */
const FALLBACK_LAYER_RANKS: ReadonlyMap<string, number> = new Map([
  ["default", 0],
  ["system", 1],
  ["organization", 2],
  ["workspace", 3],
  ["user", 4],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extract weaver governance entries from raw JSON Schema.
 * Uses 'x-weaver' (with prefix) because this runs BEFORE schema-core ingestion
 * which would move extensions to metadata.extensions.weaver (without prefix).
 */
function extractWeaverEntries(schema: JsonSchema): WeaverSchemaEntry[] {
  const entries: WeaverSchemaEntry[] = [];
  const props = schema.properties;
  if (!props) return entries;

  for (const [key, prop] of Object.entries(props)) {
    if (!isRecord(prop)) continue;
    const weaver = prop["x-weaver"];
    if (!isRecord(weaver)) continue;
    entries.push({
      path: key,
      weaver: {
        changePolicy: typeof weaver.changePolicy === "string" ? weaver.changePolicy : undefined,
        maxOverrideLayer: typeof weaver.maxOverrideLayer === "string" ? weaver.maxOverrideLayer : undefined,
        visibility: typeof weaver.visibility === "string" ? weaver.visibility : undefined,
        sessionMode: typeof weaver.sessionMode === "string" ? weaver.sessionMode : undefined,
        sensitive: typeof weaver.sensitive === "boolean" ? weaver.sensitive : undefined,
      },
    });
  }
  return entries;
}

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
    const value = service.get(fullKey);
    if (value !== undefined) {
      data[key] = value;
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Internal editor (has service + schema)
// ---------------------------------------------------------------------------

function SettingsEditorForm({
  pluginId,
  editingLayer,
  schema,
  configService,
  layerRanks,
}: PluginSettingsEditorInternalProps) {
  const effectiveLayerRanks = layerRanks ?? FALLBACK_LAYER_RANKS;
  const layerRank = effectiveLayerRanks.get(editingLayer) ?? 4;

  const weaverContext: WeaverFormrContext = useMemo(
    () => ({
      layer: editingLayer,
      layerRank,
      layerRanks: effectiveLayerRanks,
      authRoles: ["admin"],
    }),
    [editingLayer, layerRank, effectiveLayerRanks],
  );

  const processedSchema = useMemo(
    () => applySchemaMiddleware(schema, [weaverToFormrMiddleware(weaverContext)]),
    [schema, weaverContext],
  );

  const governanceMiddleware = useMemo(() => createGovernanceMiddleware(), []);

  const weaverEntries = useMemo(() => extractWeaverEntries(schema), [schema]);

  const ruleContext: GovernanceRuleContext = useMemo(
    () => ({
      layer: editingLayer,
      layerRank,
      layerRanks: effectiveLayerRanks,
      authRoles: ["admin"],
    }),
    [editingLayer, layerRank, effectiveLayerRanks],
  );

  const governanceRules = useMemo(() => buildGovernanceRules(weaverEntries, ruleContext), [weaverEntries, ruleContext]);

  const initialData = useMemo(
    () => buildInitialData(schema, configService, pluginId),
    [schema, configService, pluginId],
  );

  const registry = useMemo(() => {
    const reg = new RendererRegistry();
    const GOVERNANCE_TYPE = "governance-field";
    // Adapter: LayoutRendererProps → GovernanceFieldRendererProps.
    // Cast via unknown needed due to React 18/19 type boundary between plugin and packages.
    const adapter = (props: LayoutRendererProps) => {
      const nodeProps = props.node.props ?? {};
      return GovernanceFieldRenderer({
        changePolicy: nodeProps.changePolicy as string | undefined,
        maxOverrideLayer: nodeProps.maxOverrideLayer as string | undefined,
        reloadBehavior: nodeProps.reloadBehavior as string | undefined,
        sensitive: nodeProps.sensitive as boolean | undefined,
        children: props.children,
      });
    };
    reg.register({
      type: GOVERNANCE_TYPE,
      component: adapter as unknown as NodeRenderer["component"],
    });
    return reg;
  }, []);

  // Wire the full pipeline: schema → layout (with governance middleware) → arbiter rules.
  // useSchemaForm doesn't expose layoutMiddleware, so we call createSchemaForm + useForm directly.
  const prepared = useMemo(
    () =>
      createSchemaForm(processedSchema, {
        layoutMiddleware: [governanceMiddleware],
      }),
    [processedSchema, governanceMiddleware],
  );

  const form = useForm({
    schema: processedSchema,
    // Cast: useForm<TData> requires a static TData type but schema is dynamic;
    // the runtime value is used regardless of the compile-time assertion.
    initialData: initialData as unknown as undefined,
    validators: prepared.validators,
    // Cast: bridge governance rules → formr-core ProductionRule[] at adapter boundary.
    // Shapes are structurally compatible; bridge intentionally produces this shape.
    arbiterRules: governanceRules as unknown as readonly ProductionRule[],
  });

  const fieldPaths = useMemo(() => prepared.fields.map((f) => f.path), [prepared.fields]);

  const EMPTY_UI: Readonly<Record<string, unknown>> = useMemo(() => Object.freeze({}), []);

  const uiState = useFormSelector(form, (state) => (state.uiState ?? EMPTY_UI) as Readonly<Record<string, unknown>>);

  const fieldStates = useMemo(() => resolveFieldStates(uiState, fieldPaths), [uiState, fieldPaths]);

  const layout = useMemo(
    () => pruneHiddenFields(prepared.layout, fieldStates) ?? { ...prepared.layout, children: [] },
    [prepared.layout, fieldStates],
  );

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const result = await form.submit();
        if (!result.ok) return;

        const data = form.getState().data as Record<string, unknown>;
        for (const [key, value] of Object.entries(data)) {
          configService.set(`${pluginId}.${key}`, value, editingLayer);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [form, configService, pluginId, editingLayer],
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
        <form onSubmit={handleSubmit} noValidate aria-label={`Settings for ${pluginId}`}>
          {(layout.children?.map((node) => renderLayoutTree(node, registry)) ?? []) as React.ReactNode}
          <Button
            type="submit"
            size="sm"
            className="mt-3"
            disabled={submitting || !form.canSubmit()}
            aria-busy={submitting}
          >
            {submitting ? "Saving…" : "Save Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Public component (receives context from defineReactParts)
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
  // context.args.schema is a JsonSchema passed by the config browser; cast is safe
  // because the caller constructs it via catalogEntriesToJsonSchema which produces JsonSchema.
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

  return (
    <SettingsEditorForm pluginId={pluginId} editingLayer={editingLayer} schema={schema} configService={configService} />
  );
}
