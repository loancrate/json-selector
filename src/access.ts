import { JsonSelector } from "./ast";
import {
  compare,
  evaluateJsonSelector,
  filter,
  flatten,
  isIdentityProjection,
  normalizeSlice,
  objectProject,
  project,
  slice,
} from "./evaluate";
import { formatJsonSelector } from "./format";
import { EvaluationContext } from "./functions";
import { getBuiltinFunctionProvider } from "./functions/builtins";
import {
  asArray,
  findId,
  findIdIndex,
  getField,
  getIndex,
  isArray,
  isFalseOrEmpty,
  isObject,
} from "./util";
import { visitJsonSelector } from "./visitor";

/** A selector-based accessor not yet bound to a specific context object, supporting get/set/delete operations. */
export interface UnboundAccessor {
  readonly selector: JsonSelector;
  isValidContext(context: unknown, rootContext?: unknown): boolean;
  get(context: unknown, rootContext?: unknown): unknown;
  set(value: unknown, context: unknown, rootContext?: unknown): void;
  delete(context: unknown, rootContext?: unknown): void;
}

abstract class BaseAccessor implements UnboundAccessor {
  constructor(readonly selector: JsonSelector) {}
  abstract isValidContext(context: unknown, rootContext?: unknown): boolean;
  abstract get(context: unknown, rootContext?: unknown): unknown;
  abstract set(value: unknown, context: unknown, rootContext?: unknown): void;
  abstract delete(context: unknown, rootContext?: unknown): void;
}

abstract class ReadOnlyAccessor extends BaseAccessor {
  constructor(selector: JsonSelector) {
    super(selector);
  }

  isValidContext(): boolean {
    return true;
  }

  set(): void {
    // ignored
  }

  delete(): void {
    // ignored
  }
}

class ConstantAccessor<T> extends ReadOnlyAccessor {
  constructor(
    selector: JsonSelector,
    readonly value: T,
  ) {
    super(selector);
  }

  get(): T {
    return this.value;
  }
}

class ContextAccessor extends ReadOnlyAccessor {
  constructor() {
    super({ type: "current" });
  }

  get(context: unknown): unknown {
    return context;
  }
}
class RootContextAccessor extends ReadOnlyAccessor {
  constructor() {
    super({ type: "root" });
  }

  get(context: unknown, rootContext = context): unknown {
    return rootContext;
  }
}

/** Configuration for accessor creation, providing the function provider used during evaluation. */
export type AccessorOptions = Omit<EvaluationContext, "rootContext">;

/** Compiles a selector AST into an {@link UnboundAccessor} that can be repeatedly bound to different contexts. */
export function makeJsonSelectorAccessor(
  selector: JsonSelector,
  options?: Partial<AccessorOptions>,
): UnboundAccessor {
  return makeAccessorInternal(selector, {
    functionProvider: options?.functionProvider ?? getBuiltinFunctionProvider(),
  });
}

function makeAccessorInternal(
  selector: JsonSelector,
  options: AccessorOptions,
): UnboundAccessor {
  return visitJsonSelector<UnboundAccessor, undefined>(
    selector,
    {
      current() {
        return new ContextAccessor();
      },
      root() {
        return new RootContextAccessor();
      },
      literal(selector) {
        return new ConstantAccessor(selector, selector.value);
      },
      identifier(selector) {
        const { id } = selector;
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown) {
            return isObject(context);
          }
          get(context: unknown) {
            return getField(context, id);
          }
          set(value: unknown, context: unknown) {
            if (isObject(context)) {
              context[id] = value;
            }
          }
          delete(context: unknown) {
            if (isObject(context)) {
              delete context[id];
            }
          }
        };
        return new Accessor();
      },
      fieldAccess(selector) {
        const { expression, field } = selector;
        const base = makeAccessorInternal(expression, options);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            const value = base.get(context, rootContext);
            return isObject(value);
          }
          get(context: unknown, rootContext = context) {
            const obj = base.get(context, rootContext);
            return getField(obj, field);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const obj = base.get(context, rootContext);
            if (isObject(obj)) {
              obj[field] = value;
            }
          }
          delete(context: unknown, rootContext = context) {
            const obj = base.get(context, rootContext);
            if (isObject(obj)) {
              delete obj[field];
            }
          }
        };
        return new Accessor();
      },
      indexAccess(selector) {
        const { expression, index } = selector;
        const base = makeAccessorInternal(expression, options);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            const value = base.get(context, rootContext);
            return isArray(value);
          }
          get(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            return getIndex(arr, index);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              arr[index < 0 ? arr.length + index : index] = value;
            }
          }
          delete(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              arr.splice(index, 1);
            }
          }
        };
        return new Accessor();
      },
      idAccess(selector) {
        const { expression, id } = selector;
        const base = makeAccessorInternal(expression, options);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            const value = base.get(context, rootContext);
            return isArray(value);
          }
          get(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            return findId(arr, id);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              const index = findIdIndex(arr, id);
              if (index >= 0) {
                arr[index] = value;
              }
            }
          }
          delete(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              const index = findIdIndex(arr, id);
              if (index >= 0) {
                arr.splice(index, 1);
              }
            }
          }
        };
        return new Accessor();
      },
      project(selector) {
        const { expression, projection } = selector;
        const base = makeAccessorInternal(expression, options);
        const proj = !isIdentityProjection(projection)
          ? makeAccessorInternal(projection, options)
          : undefined;
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            const value = base.get(context, rootContext);
            return isArray(value);
          }
          get(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            return project(arr, projection, { ...options, rootContext });
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              if (proj) {
                for (const element of arr) {
                  proj.set(value, element, rootContext);
                }
              } else {
                replaceArray(arr, asArray(value));
              }
            }
          }
          delete(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              if (proj) {
                for (const element of arr) {
                  proj.delete(element, rootContext);
                }
              } else {
                arr.length = 0;
              }
            }
          }
        };
        return new Accessor();
      },
      objectProject(selector) {
        const { expression, projection } = selector;
        const base = makeAccessorInternal(expression, options);
        const proj = !isIdentityProjection(projection)
          ? makeAccessorInternal(projection, options)
          : undefined;
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            const value = base.get(context, rootContext);
            return isObject(value);
          }
          get(context: unknown, rootContext = context) {
            const obj = base.get(context, rootContext);
            return objectProject(obj, projection, { ...options, rootContext });
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const obj = base.get(context, rootContext);
            if (isObject(obj)) {
              if (proj) {
                for (const v of Object.values(obj)) {
                  proj.set(value, v, rootContext);
                }
              } else {
                for (const key of Object.keys(obj)) {
                  obj[key] = value;
                }
              }
            }
          }
          delete(context: unknown, rootContext = context) {
            const obj = base.get(context, rootContext);
            if (isObject(obj)) {
              if (proj) {
                for (const v of Object.values(obj)) {
                  proj.delete(v, rootContext);
                }
              } else {
                for (const key of Object.keys(obj)) {
                  delete obj[key];
                }
              }
            }
          }
        };
        return new Accessor();
      },
      filter(selector) {
        const { expression, condition } = selector;
        const base = makeAccessorInternal(expression, options);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            const value = base.get(context, rootContext);
            return isArray(value);
          }
          get(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            return filter(arr, condition, { ...options, rootContext });
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              replaceArray(
                arr,
                invertedFilter(arr, condition, {
                  ...options,
                  rootContext,
                }).concat(asArray(value)),
              );
            }
          }
          delete(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              replaceArray(
                arr,
                invertedFilter(arr, condition, {
                  ...options,
                  rootContext,
                }),
              );
            }
          }
        };
        return new Accessor();
      },
      slice(selector) {
        const { expression, start, end, step } = selector;
        const base = makeAccessorInternal(expression, options);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            const value = base.get(context, rootContext);
            return isArray(value) || typeof value === "string";
          }
          get(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            return slice(arr, start, end, step);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              replaceArray(
                arr,
                invertedSlice(arr, start, end, step).concat(asArray(value)),
              );
            }
          }
          delete(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              replaceArray(arr, invertedSlice(arr, start, end, step));
            }
          }
        };
        return new Accessor();
      },
      flatten(selector) {
        const { expression } = selector;
        const base = makeAccessorInternal(expression, options);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            const value = base.get(context, rootContext);
            return isArray(value);
          }
          get(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            return flatten(arr);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              replaceArray(arr, asArray(value));
            }
          }
          delete(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              arr.length = 0;
            }
          }
        };
        return new Accessor();
      },
      not(selector) {
        const { expression } = selector;
        const base = makeAccessorInternal(expression, options);
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            const value = base.get(context, rootContext);
            return isFalseOrEmpty(value);
          }
        };
        return new Accessor();
      },
      compare(selector) {
        const { lhs, rhs, operator } = selector;
        const la = makeAccessorInternal(lhs, options);
        const ra = makeAccessorInternal(rhs, options);
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            const lv = la.get(context, rootContext);
            const rv = ra.get(context, rootContext);
            return compare(lv, rv, operator);
          }
        };
        return new Accessor();
      },
      and(selector) {
        const { lhs, rhs } = selector;
        const la = makeAccessorInternal(lhs, options);
        const ra = makeAccessorInternal(rhs, options);
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            const lv = la.get(context, rootContext);
            return isFalseOrEmpty(lv) ? lv : ra.get(context, rootContext);
          }
        };
        return new Accessor();
      },
      or(selector) {
        const { lhs, rhs } = selector;
        const la = makeAccessorInternal(lhs, options);
        const ra = makeAccessorInternal(rhs, options);
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            const lv = la.get(context, rootContext);
            return !isFalseOrEmpty(lv) ? lv : ra.get(context, rootContext);
          }
        };
        return new Accessor();
      },
      ternary(selector) {
        const { condition, consequent, alternate } = selector;
        const ca = makeAccessorInternal(condition, options);
        const ta = makeAccessorInternal(consequent, options);
        const aa = makeAccessorInternal(alternate, options);
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            const cv = ca.get(context, rootContext);
            return isFalseOrEmpty(cv)
              ? aa.get(context, rootContext)
              : ta.get(context, rootContext);
          }
        };
        return new Accessor();
      },
      pipe(selector) {
        const { lhs, rhs } = selector;
        const la = makeAccessorInternal(lhs, options);
        const ra = makeAccessorInternal(rhs, options);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            const lv = la.get(context, rootContext);
            return ra.isValidContext(lv, rootContext);
          }
          get(context: unknown, rootContext = context) {
            const lv = la.get(context, rootContext);
            return ra.get(lv, rootContext);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const lv = la.get(context, rootContext);
            ra.set(value, lv, rootContext);
          }
          delete(context: unknown, rootContext = context) {
            const lv = la.get(context, rootContext);
            ra.delete(lv, rootContext);
          }
        };
        return new Accessor();
      },
      functionCall(selector) {
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            return evaluateJsonSelector(selector, context, {
              ...options,
              rootContext,
            });
          }
        };
        return new Accessor();
      },
      expressionRef(selector) {
        // Expression references are only meaningful as function arguments
        return new ConstantAccessor(selector, null);
      },
      multiSelectList(selector) {
        const { expressions } = selector;
        const accessors = expressions.map((e) =>
          makeAccessorInternal(e, options),
        );
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            if (context == null) {
              return null;
            }
            return accessors.map((a) => a.get(context, rootContext));
          }
        };
        return new Accessor();
      },
      multiSelectHash(selector) {
        const { entries } = selector;
        const entryAccessors = entries.map(({ key, value }) => ({
          key,
          accessor: makeAccessorInternal(value, options),
        }));
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            if (context == null) {
              return null;
            }
            const result: Record<string, unknown> = {};
            for (const { key, accessor } of entryAccessors) {
              result[key] = accessor.get(context, rootContext);
            }
            return result;
          }
        };
        return new Accessor();
      },
    },
    undefined,
  );
}

/** A selector accessor bound to a specific context, providing typed get/set/delete and validity checking. */
export interface Accessor<T> {
  readonly selector: JsonSelector;
  readonly valid: boolean;
  readonly path: string;
  get(): T;
  set(value: T): void;
  delete(): void;
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
    set(value: unknown) {
      unbound.set(value, context, rootContext);
    },
    delete() {
      unbound.delete(context, rootContext);
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

function replaceArray(
  target: unknown[],
  source: readonly unknown[],
): unknown[] {
  target.length = 0;
  target.push(...source);
  return target;
}

function invertedFilter(
  value: unknown[],
  condition: JsonSelector,
  evalCtx: EvaluationContext,
): unknown[] {
  return value.filter((e) =>
    isFalseOrEmpty(evaluateJsonSelector(condition, e, evalCtx)),
  );
}

/** Returns the complement of a slice: the elements that would NOT be selected by the given slice parameters. */
export function invertedSlice(
  value: unknown[],
  start: number | undefined,
  end?: number,
  step?: number,
): unknown[] {
  ({ start, end, step } = normalizeSlice(value.length, start, end, step));
  const collected: unknown[] = [];
  if (step > 0) {
    if (start >= end) {
      return value;
    }
    let skip = start;
    for (let i = 0; i < value.length; ++i) {
      if (i < skip || i >= end) {
        collected.push(value[i]);
      } else {
        skip += step;
      }
    }
  } else {
    if (start <= end) {
      return value;
    }
    let skip = start;
    for (let i = value.length - 1; i >= 0; --i) {
      if (i > skip || i <= end) {
        collected.push(value[i]);
      } else {
        skip += step;
      }
    }
  }
  return collected;
}
