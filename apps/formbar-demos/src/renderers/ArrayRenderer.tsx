import type { FormApi } from "@formbar/core";
import type { LayoutNode, SchemaFieldInfo } from "@formbar/from-schema";
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@ghost-shell/ui";
import { useCallback, useState } from "react";

export interface ArrayRendererProps {
  readonly node: LayoutNode;
  readonly form: FormApi;
  readonly fieldMap: Map<string, SchemaFieldInfo>;
  readonly onChange: (path: string, value: unknown) => void;
  readonly itemSchema?: Record<string, unknown>;
}

export function ArrayRenderer({ node, form, fieldMap, onChange, itemSchema }: ArrayRendererProps) {
  const field = node.path ? fieldMap.get(node.path) : undefined;
  const title = field?.metadata?.title ?? node.path ?? "Items";
  const [items, setItems] = useState<unknown[]>(() => {
    const data = form.getState().data as Record<string, unknown> | undefined;
    const val = data?.[node.path ?? ""];
    return Array.isArray(val) ? val : [];
  });

  const updateItems = useCallback(
    (newItems: unknown[]) => {
      setItems(newItems);
      if (node.path) onChange(node.path, newItems);
    },
    [node.path, onChange],
  );

  const addItem = () => {
    const hasRealChildren = node.children?.some((c) => c.type === "field" && c.path && !c.path.endsWith("[]")) ?? false;
    const isObjectItems = hasRealChildren || itemSchema?.type === "object";
    updateItems([...items, isObjectItems ? {} : ""]);
  };

  const removeItem = (index: number) => {
    updateItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground">{title}</Label>
        <Badge variant="secondary" className="text-xs">
          {items.length} items
        </Badge>
      </div>
      <div className="flex flex-col gap-2 rounded-md border border-border-muted p-3">
        {items.length === 0 && <p className="text-xs text-muted-foreground italic">No items yet</p>}
        {items.map((item, index) => (
          <ArrayItem
            key={index}
            item={item}
            index={index}
            items={items}
            itemSchema={itemSchema}
            node={node}
            fieldMap={fieldMap}
            updateItems={updateItems}
            removeItem={removeItem}
          />
        ))}
        <Button variant="outline" size="sm" onClick={addItem} className="self-start mt-1">
          + Add Item
        </Button>
      </div>
    </div>
  );
}

interface ArrayItemProps {
  readonly item: unknown;
  readonly index: number;
  readonly items: unknown[];
  readonly itemSchema?: Record<string, unknown>;
  readonly node: LayoutNode;
  readonly fieldMap: Map<string, SchemaFieldInfo>;
  readonly updateItems: (newItems: unknown[]) => void;
  readonly removeItem: (index: number) => void;
}

function ArrayItem({ item, index, items, itemSchema, node, fieldMap, updateItems, removeItem }: ArrayItemProps) {
  if (typeof item !== "object" || item === null) {
    return (
      <div className="flex items-center gap-2">
        <Input
          className="flex-1"
          value={String(item ?? "")}
          onChange={(e) => {
            const newItems = [...items];
            newItems[index] = e.target.value;
            updateItems(newItems);
          }}
          placeholder={`Item ${index + 1}`}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeItem(index)}
          className="text-destructive shrink-0 h-8 w-8 p-0"
        >
          ×
        </Button>
      </div>
    );
  }

  const realChildren = node.children?.filter((c) => c.type === "field" && c.path && !c.path.endsWith("[]"));
  const properties = (itemSchema?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const record = item as Record<string, unknown>;

  // Derive field entries from layout children (preferred) or itemSchema fallback
  const fieldEntries: Array<{ key: string; label: string; enumValues: string[] | undefined; fieldType: string }> =
    realChildren && realChildren.length > 0
      ? realChildren.map((child) => {
          const field = child.path ? fieldMap.get(child.path) : undefined;
          const key = child.path ? (child.path.split(".").pop() ?? "") : "";
          const label = field?.metadata?.title ?? key;
          const enumValues = field?.metadata?.enum as string[] | undefined;
          const fieldType = field?.type ?? "string";
          return { key, label, enumValues, fieldType };
        })
      : Object.entries(properties).map(([key, propSchema]) => ({
          key,
          label: (propSchema.title as string) ?? key,
          enumValues: propSchema.enum as string[] | undefined,
          fieldType: propSchema.type as string,
        }));

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-border-muted p-3">
        {fieldEntries.map(({ key, label, enumValues, fieldType }) => (
          <div key={key} className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {renderArrayItemField(key, record, fieldType, enumValues, (newValue) => {
              const newItems = [...items];
              newItems[index] = { ...record, [key]: newValue };
              updateItems(newItems);
            })}
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => removeItem(index)}
        className="text-destructive shrink-0 h-8 w-8 p-0"
      >
        ×
      </Button>
    </div>
  );
}

function renderArrayItemField(
  key: string,
  record: Record<string, unknown>,
  fieldType: string,
  enumValues: string[] | undefined,
  onChange: (value: unknown) => void,
): React.ReactNode {
  if (enumValues) {
    return (
      <Select value={String(record[key] ?? "")} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {enumValues.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (fieldType === "boolean") {
    return <Switch checked={Boolean(record[key])} onCheckedChange={onChange} />;
  }
  if (fieldType === "number" || fieldType === "integer") {
    return (
      <Input
        type="number"
        className="h-8 text-xs"
        value={String(record[key] ?? "")}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      />
    );
  }
  return <Input className="h-8 text-xs" value={String(record[key] ?? "")} onChange={(e) => onChange(e.target.value)} />;
}
