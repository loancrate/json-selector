import {
  AccessorOptions,
  makeJsonSelectorAccessor,
  UnboundAccessor,
} from "./access";
import { JsonSelector } from "./ast";
import { formatJsonSelector } from "./format";

/** A selector accessor bound to a specific context, providing typed get/set/delete and validity checking. */
export interface Accessor<T> {
  readonly selector: JsonSelector;
  readonly valid: boolean;
  readonly path: string;
  get(): T;
  getOrThrow(): T;
  set(value: T): void;
  setOrThrow(value: T): void;
  delete(): void;
  deleteOrThrow(): void;
}

/** Binds an {@link UnboundAccessor} to a specific context and root, producing a ready-to-use {@link Accessor}. */
export function bindJsonSelectorAccessor(
  unbound: UnboundAccessor,
  context: unknown,
  rootContext = context,
): Accessor<unknown> {
  const { selector } = unbound;
  const valid = unbound.isValidContext(context, rootContext);
  return {
    selector,
    valid,
    path: formatJsonSelector(selector),
    get() {
      return unbound.get(context, rootContext);
    },
    getOrThrow() {
      return unbound.getOrThrow(context, rootContext);
    },
    set(value: unknown) {
      unbound.set(value, context, rootContext);
    },
    setOrThrow(value: unknown) {
      unbound.setOrThrow(value, context, rootContext);
    },
    delete() {
      unbound.delete(context, rootContext);
    },
    deleteOrThrow() {
      unbound.deleteOrThrow(context, rootContext);
    },
  };
}

/** One-step convenience: parses a selector into an accessor already bound to the given context. */
export function accessWithJsonSelector(
  selector: JsonSelector,
  context: unknown,
  rootContext = context,
  options?: Partial<AccessorOptions>,
): Accessor<unknown> {
  return bindJsonSelectorAccessor(
    makeJsonSelectorAccessor(selector, options),
    context,
    rootContext,
  );
}
