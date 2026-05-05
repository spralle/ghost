interface CodeBlockProps {
  readonly title: string;
  readonly code: unknown;
  readonly defaultOpen?: boolean;
}

export function CodeBlock({ title, code, defaultOpen = false }: CodeBlockProps) {
  return (
    <details open={defaultOpen || undefined} className="group">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1">
        {title}
      </summary>
      <pre className="mt-2 rounded-md bg-surface-inset p-3 text-xs text-code-foreground overflow-auto max-h-80 border border-border-muted font-mono">
        {typeof code === "string" ? code : JSON.stringify(code, null, 2)}
      </pre>
    </details>
  );
}
