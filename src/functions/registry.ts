import { FallbackMapView } from "./FallbackMapView";
import { getBuiltinFunctionProvider } from "./builtins";
import { FunctionProvider } from "./provider";
import { FunctionDefinition } from "./types";

/**
 * Function registry for built-in and custom functions.
 * Pass `null` as the base provider to omit built-in functions.
 */
export class FunctionRegistry extends FallbackMapView<
  string,
  FunctionDefinition
> {
  private readonly custom: Map<string, FunctionDefinition>;

  constructor(
    baseProvider: FunctionProvider | null = getBuiltinFunctionProvider(),
  ) {
    const custom = new Map<string, FunctionDefinition>();
    super(custom, baseProvider ?? undefined);
    this.custom = custom;
  }

  /**
   * Register a custom function (can override built-ins).
   */
  register(def: FunctionDefinition): void {
    this.custom.set(def.name, def);
  }

  /**
   * Unregister a custom function.
   */
  unregister(name: string): boolean {
    return this.custom.delete(name);
  }
}
