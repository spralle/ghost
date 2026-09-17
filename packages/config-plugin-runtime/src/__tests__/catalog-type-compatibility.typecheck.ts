import type { PluginConfigCatalogService } from "@ghost-shell/contracts";
import type { ComposedSchemaEntry as EngineComposedSchemaEntry } from "@weaver/config-engine";
import type { PluginConfigCatalog, ComposedSchemaEntry as RuntimeComposedSchemaEntry } from "../index.js";

declare const engineEntry: EngineComposedSchemaEntry;
declare const runtimeEntry: RuntimeComposedSchemaEntry;
declare const runtimeCatalog: PluginConfigCatalog;

const runtimeCompatibleWithOwner: RuntimeComposedSchemaEntry = engineEntry;
const ownerCompatibleWithRuntime: EngineComposedSchemaEntry = runtimeEntry;
const serviceCompatibleWithCatalog: PluginConfigCatalogService = runtimeCatalog;

void runtimeCompatibleWithOwner;
void ownerCompatibleWithRuntime;
void serviceCompatibleWithCatalog;
