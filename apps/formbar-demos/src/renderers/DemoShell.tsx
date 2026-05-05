import { Badge } from "@ghost-shell/ui";
import { CodeBlock } from "./CodeBlock";

interface CodeBlockEntry {
  readonly title: string;
  readonly code: string | object;
  readonly defaultOpen?: boolean;
}

interface DemoShellProps {
  readonly title: string;
  readonly description: string;
  readonly motivation?: string;
  readonly features: readonly string[];
  readonly schema: object;
  readonly layout?: object;
  readonly codeBlocks?: readonly CodeBlockEntry[];
  readonly children: React.ReactNode;
}

export function DemoShell({
  title,
  description,
  motivation,
  features,
  schema,
  layout,
  codeBlocks,
  children,
}: DemoShellProps) {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
        {motivation && (
          <p className="text-sm italic text-muted-foreground mt-2 border-l-2 border-muted pl-3">{motivation}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {features.map((f) => (
            <Badge key={f} variant="secondary" className="text-xs">
              {f}
            </Badge>
          ))}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-80 flex flex-col gap-3 shrink-0">
          <CodeBlock title="JSON Schema" code={schema} defaultOpen />
          {layout && <CodeBlock title="Layout" code={layout} />}
          {codeBlocks?.map((block) => (
            <CodeBlock key={block.title} title={block.title} code={block.code} defaultOpen={block.defaultOpen} />
          ))}
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
