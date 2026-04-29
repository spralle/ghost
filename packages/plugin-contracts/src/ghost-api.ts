import type { ContextApi } from "./context-contribution-registry.js";
import type { Disposable } from "./disposable.js";
import type { Event } from "./event.js";
import type { PluginServices } from "./plugin-services.js";
import type { ServiceToken } from "./service-token.js";
import type { WorkspaceService } from "./workspace-service.js";

// ─── GhostApi (top-level namespace) ───

/** The plugin-facing runtime API, injected during plugin activation. */
export interface GhostApi {
  /** Action registration, execution, and discovery. */
  readonly actions: ActionService;
  /** Window management and UI primitives. */
  readonly window: WindowService;
  /** View discovery and opening. */
  readonly views: ViewService;
  /** Workspace management. */
  readonly workspaces: WorkspaceService;
  /** Router service for type-safe plugin navigation. */
  readonly router?: PluginRouterServiceApi | undefined;
  /** Menu contribution resolution and dispatch. */
  readonly menus?: MenuService | undefined;
}

// ─── ActionService ───

/** Service for registering, executing, and discovering actions. */
export interface ActionService {
  /** Register a runtime action handler. Returns Disposable for cleanup. */
  registerAction(id: string, handler: (...args: unknown[]) => unknown): Disposable;

  /** Execute an action by ID. Shell handles plugin activation transparently. */
  executeAction<T = void>(id: string, ...args: unknown[]): Promise<T | undefined>;

  /** Get all registered actions with current enabled state and keybinding hints. */
  getActions(): Promise<ActionDescriptor[]>;

  /** Fires when the action registry changes (plugin activated/deactivated). */
  readonly onDidChangeActions: Event<void>;
}

/** Descriptor for a registered action, returned by getActions(). */
export interface ActionDescriptor {
  readonly id: string;
  readonly title: string;
  readonly category?: string;
  readonly keybinding?: string;
  readonly enabled: boolean;
  readonly disabledReason?: string;
  readonly pluginId: string;
}

// ─── WindowService ───

/** Service for window management and UI primitives. */
export interface WindowService {
  /** The unique ID of the current window. */
  readonly windowId: string;
  /** Whether this window is a popout (lightweight tab renderer). */
  readonly isPopout: boolean;

  /** Get descriptors for all open windows. */
  getWindows(): WindowDescriptor[];
  /** Fires when windows open or close. */
  readonly onDidChangeWindows: Event<void>;

  /**
   * Show a quick pick overlay with the given items.
   * Returns the selected item, or undefined if dismissed.
   */
  showQuickPick<T extends QuickPickItem>(items: T[], options?: QuickPickOptions): Promise<T | undefined>;

  /**
   * Create a QuickPick with full lifecycle control.
   * Call show() to display, dispose() when done.
   */
  createQuickPick<T extends QuickPickItem>(): QuickPick<T>;

  /**
   * Show an input box overlay.
   * Returns the entered text, or undefined if dismissed.
   */
  showInputBox(options?: InputBoxOptions): Promise<string | undefined>;

  /** Show a notification message. */
  showNotification(message: string, severity: "info" | "warning" | "error"): void;
}

/** Descriptor for an open window. */
export interface WindowDescriptor {
  readonly windowId: string;
  readonly isPopout: boolean;
  readonly hostWindowId: string | null;
  readonly activePartId: string | null;
}

// ─── QuickPick ───

/** An item in a QuickPick list. */
export interface QuickPickItem {
  /** Primary label text. */
  readonly label: string;
  /** Secondary description (shown to the right of label). */
  readonly description?: string;
  /** Detail text (shown below label). */
  readonly detail?: string;
  /** Whether this item can be selected. Defaults to true. */
  readonly enabled?: boolean;
}

/** Options for showQuickPick(). */
export interface QuickPickOptions {
  /** Placeholder text in the filter input. */
  readonly placeholder?: string;
  /** Whether to match filter against description. */
  readonly matchOnDescription?: boolean;
  /** Whether to match filter against detail. */
  readonly matchOnDetail?: boolean;
}

/** A QuickPick with full lifecycle control. */
export interface QuickPick<T extends QuickPickItem> extends Disposable {
  /** The items to display. Setting this triggers a re-render. */
  items: T[];
  /** The currently highlighted items. */
  readonly activeItems: readonly T[];
  /** The current filter text. */
  value: string;
  /** Placeholder text in the filter input. */
  placeholder: string;

  /** Fires when the filter text changes. */
  readonly onDidChangeValue: Event<string>;
  /** Fires when the highlighted item changes. */
  readonly onDidChangeActive: Event<readonly T[]>;
  /** Fires when the user accepts (Enter). */
  readonly onDidAccept: Event<void>;
  /** Fires when the QuickPick is hidden (Escape or blur). */
  readonly onDidHide: Event<void>;

  /** Show the QuickPick overlay. */
  show(): void;
  /** Hide the QuickPick overlay. */
  hide(): void;
}

// ─── ViewService ───

/** Descriptor for an available part/view definition. */
export interface ViewDescriptor {
  /** The part definition ID (used to open it). */
  readonly definitionId: string;
  /** Human-readable title. */
  readonly title: string;
  /** Which dock container slot this view prefers. */
  readonly slot: "main" | "secondary" | "side";
  /** The plugin that contributes this view. */
  readonly pluginId: string;
}

/** Options for openView(). */
export interface OpenViewOptions {
  /** Override the default tab label. */
  readonly label?: string;
  /** Arguments to pass to the part instance. */
  readonly args?: Record<string, string>;
}

/** Service for discovering and opening views (parts). */
export interface ViewService {
  /** Get all available part definitions from enabled plugins. */
  getViewDefinitions(): ViewDescriptor[];
  /** Open a view as a new tab in the dock tree. Returns the new tab ID. */
  openView(definitionId: string, options?: OpenViewOptions): string;
}

// ─── InputBox ───

/** Options for showInputBox(). */
export interface InputBoxOptions {
  /** Placeholder text. */
  readonly placeholder?: string;
  /** Pre-filled value. */
  readonly value?: string;
  /** Prompt text above the input. */
  readonly prompt?: string;
}

// ─── PluginRouterServiceApi ───

/**
 * Router service API exposed to plugins via GhostApi.
 * Provides factory method for creating type-safe plugin routers.
 */
export interface PluginRouterServiceApi {
  /**
   * Create a type-safe plugin router scoped to the given route definitions.
   * Route definitions should be created via defineRoutes() from @ghost-shell/router.
   */
  createPluginRouter<T extends Record<string, { readonly id: string; readonly schema: unknown }>>(routes: T): unknown;
}

// ─── MenuService ───

/** Resolved menu action returned to plugins. */
export interface ResolvedMenuAction {
  /** The action ID (pass to dispatch). */
  readonly id: string;
  /** Human-readable title for the menu item. */
  readonly title: string;
  /** Group name for visual grouping (separator between groups). */
  readonly group?: string;
  /** Sort order within group. */
  readonly order?: number;
}

/** Service for resolving and dispatching menu contributions. */
export interface MenuService {
  /**
   * Resolve menu contributions for a given menu point and context.
   * Returns actions that are visible in the current context (predicates evaluated).
   *
   * @param menuId - The menu contribution point (e.g., 'entityTable/row')
   * @param context - Context bag for predicate evaluation
   * @returns Resolved actions, sorted by group+order, filtered by 'when' predicates
   */
  resolve(menuId: string, context: Record<string, unknown>): ResolvedMenuAction[];

  /**
   * Dispatch an action by ID with the given context.
   *
   * @param actionId - The action to dispatch
   * @param context - Context passed to the intent resolution
   * @returns true if the action was executed, false if blocked by predicate or not found
   */
  dispatch(actionId: string, context: Record<string, unknown>): Promise<boolean>;
}

// ─── ActivationContext ───

/**
 * Context passed to a plugin's activate() function.
 * Subscriptions are auto-disposed when the plugin deactivates.
 */
export interface ActivationContext {
  /**
   * Push Disposables here for automatic cleanup on deactivation.
   * The shell disposes all items when the plugin is deactivated.
   */
  readonly subscriptions: Disposable[];
  /** The ID of the plugin being activated. */
  readonly pluginId: string;
  /** Service accessor — access any registered service by token. */
  readonly services: PluginServices;
  /** Context contribution API for reactive state sharing between plugins. */
  readonly context?: ContextApi;

  /**
   * Create framework-managed reactive state.
   * The returned object is a mutable proxy — mutations are automatically detected
   * and can be replicated to popout windows.
   */
  createState<S extends object>(initial: S): S;

  /**
   * Register a service implementation for the given token.
   * Other plugins can then access it via services.getService(token).
   * Returns a Disposable to unregister.
   */
  registerService<T>(token: ServiceToken<T>, implementation: T): Disposable;
}

// ─── DeactivationContext ───

/**
 * Context passed to a plugin's optional deactivate() function.
 * Allows the plugin to perform cleanup before the shell disposes subscriptions.
 */
export interface DeactivationContext {
  /** The ID of the plugin being deactivated. */
  readonly pluginId: string;
}
