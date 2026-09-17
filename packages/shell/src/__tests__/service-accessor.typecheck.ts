import type { PluginServices } from "@ghost-shell/contracts";
import { createServiceToken } from "@ghost-shell/contracts";
import { createPluginServiceAccessor } from "../plugin-service-accessor.js";

interface ExampleService {
  readonly value: string;
}

const accessor: PluginServices["getService"] = createPluginServiceAccessor(() => null);
const tokenResult: ExampleService | null = accessor(createServiceToken<ExampleService>("example.service"));
const stringResult: ExampleService | null = accessor<ExampleService>("example.service");
const defaultResult: unknown | null = accessor("example.service");

void tokenResult;
void stringResult;
void defaultResult;
