import { Fragment, useState } from "react";
import "./globals.css";
import { cn, ScrollArea } from "@ghost-shell/ui";
import { demos } from "./demos/index";

export function App() {
  const [activeDemo, setActiveDemo] = useState(0);
  const Demo = demos[activeDemo]?.component;

  return (
    <div className="flex h-screen">
      <aside className="w-72 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold text-foreground">Formbar Demos</h1>
          <p className="text-xs text-muted-foreground mt-1">JSON Schema → Beautiful Forms</p>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 flex flex-col gap-1">
            {demos.map((d, i) => {
              const showCategory = i === 0 || demos[i - 1].category !== d.category;
              return (
                <Fragment key={d.id}>
                  {showCategory && (
                    <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {d.category}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveDemo(i)}
                    className={cn(
                      "text-left px-3 py-2 rounded-md text-sm transition-colors",
                      i === activeDemo
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50",
                    )}
                  >
                    <div className="font-medium">{d.title}</div>
                    <div className="text-xs opacity-70 mt-0.5">{d.subtitle}</div>
                  </button>
                </Fragment>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>
      <main className="flex-1 overflow-auto">
        {Demo ? <Demo /> : <div className="p-8 text-muted-foreground">No demos available</div>}
      </main>
    </div>
  );
}
