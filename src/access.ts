import {
  ReadOnlySelector,
  readOnlyError,
  requireArrayOrStringParent,
  requireArrayParent,
  requireIdIndex,
  requireObjectContext,
  requireObjectParent,
  resolveInBoundsIndex,
} from "./access-guards";
import { invertedFilter, invertedSlice, replaceArray } from "./access-util";
import {
  JsonSelector,
  JsonSelectorCurrent,
  JsonSelectorExpressionRef,
  JsonSelectorFunctionCall,
  JsonSelectorLet,
  JsonSelectorLiteral,
  JsonSelectorRoot,
  JsonSelectorVariableRef,
} from "./ast";
import {
  compare,
  evaluateJsonSelector,
  filter,
  flatten,
  isIdentityProjection,
  objectProject,
  performArithmetic,
  performUnaryArithmetic,
  project,
  slice,
} from "./evaluate";
import type { EvaluationContext } from "./evaluation-context";
import { getBuiltinFunctionProvider } from "./functions/builtins";
import { CURRENT_NODE, ROOT_NODE } from "./parser";
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
  getOrThrow(context: unknown, rootContext?: unknown): unknown;
  set(value: unknown, context: unknown, rootContext?: unknown): void;
  setOrThrow(value: unknown, context: unknown, rootContext?: unknown): void;
  delete(context: unknown, rootContext?: unknown): void;
  deleteOrThrow(context: unknown, rootContext?: unknown): void;
}

abstract class BaseAccessor<
  S extends JsonSelector = JsonSelector,
> implements UnboundAccessor {
  constructor(readonly selector: S) {}
  abstract isValidContext(context: unknown, rootContext?: unknown): boolean;
  abstract get(context: unknown, rootContext?: unknown): unknown;
  abstract getOrThrow(context: unknown, rootContext?: unknown): unknown;
  abstract set(value: unknown, context: unknown, rootContext?: unknown): void;
  abstract setOrThrow(
    value: unknown,
    context: unknown,
    rootContext?: unknown,
  ): void;
  abstract delete(context: unknown, rootContext?: unknown): void;
  abstract deleteOrThrow(context: unknown, rootContext?: unknown): void;
}

abstract class ReadOnlyAccessor<
  S extends ReadOnlySelector = ReadOnlySelector,
> extends BaseAccessor<S> {
  constructor(selector: S) {
    super(selector);
  }

  isValidContext(): boolean {
    return true;
  }

  getOrThrow(context: unknown, rootContext?: unknown): unknown {
    return this.get(context, rootContext);
  }

  set(): void {
    // ignored
  }

  setOrThrow(): void {
    throw readOnlyError(this.selector, "set");
  }

  delete(): void {
    // ignored
  }

  deleteOrThrow(): void {
    throw readOnlyError(this.selector, "delete");
  }
}

type ConstantSelector = JsonSelectorLiteral | JsonSelectorExpressionRef;

class ConstantAccessor<T> extends ReadOnlyAccessor<ConstantSelector> {
  constructor(
    selector: ConstantSelector,
    readonly value: T,
  ) {
    super(selector);
  }

  get(): T {
    return this.value;
  }
}

class ContextAccessor extends ReadOnlyAccessor<JsonSelectorCurrent> {
  constructor() {
    super(CURRENT_NODE);
  }

  get(context: unknown): unknown {
    return context;
  }
}

class RootContextAccessor extends ReadOnlyAccessor<JsonSelectorRoot> {
  constructor() {
    super(ROOT_NODE);
  }

  get(context: unknown, rootContext = context): unknown {
    return rootContext;
  }
}

type EvaluateSelector =
  | JsonSelectorFunctionCall
  | JsonSelectorVariableRef
  | JsonSelectorLet;

class EvaluateAccessor extends ReadOnlyAccessor<EvaluateSelector> {
  constructor(
    selector: EvaluateSelector,
    private readonly options: AccessorOptions,
  ) {
    super(selector);
  }

  get(context: unknown, rootContext = context): unknown {
    return evaluateJsonSelector(this.selector, context, {
      ...this.options,
      rootContext,
    });
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
          getOrThrow(context: unknown) {
            const objectContext = requireObjectContext(
              context,
              selector,
              "get",
            );
            return objectContext[id] ?? null;
          }
          set(value: unknown, context: unknown) {
            if (isObject(context)) {
              context[id] = value;
            }
          }
          setOrThrow(value: unknown, context: unknown) {
            const objectContext = requireObjectContext(
              context,
              selector,
              "set",
            );
            objectContext[id] = value;
          }
          delete(context: unknown) {
            if (isObject(context)) {
              delete context[id];
            }
          }
          deleteOrThrow(context: unknown) {
            const objectContext = requireObjectContext(
              context,
              selector,
              "delete",
            );
            delete objectContext[id];
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
          getOrThrow(context: unknown, rootContext = context) {
            const obj = requireObjectParent(
              base.getOrThrow(context, rootContext),
              selector,
              "get",
            );
            return obj[field] ?? null;
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const obj = base.get(context, rootContext);
            if (isObject(obj)) {
              obj[field] = value;
            }
          }
          setOrThrow(value: unknown, context: unknown, rootContext = context) {
            const obj = requireObjectParent(
              base.getOrThrow(context, rootContext),
              selector,
              "set",
            );
            obj[field] = value;
          }
          delete(context: unknown, rootContext = context) {
            const obj = base.get(context, rootContext);
            if (isObject(obj)) {
              delete obj[field];
            }
          }
          deleteOrThrow(context: unknown, rootContext = context) {
            const obj = requireObjectParent(
              base.getOrThrow(context, rootContext),
              selector,
              "delete",
            );
            delete obj[field];
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
          getOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "get",
            );
            return arr[index < 0 ? arr.length + index : index] ?? null;
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              arr[index < 0 ? arr.length + index : index] = value;
            }
          }
          setOrThrow(value: unknown, context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "set",
            );
            const resolvedIndex = resolveInBoundsIndex(
              arr,
              index,
              selector,
              "set",
            );
            arr[resolvedIndex] = value;
          }
          delete(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              arr.splice(index, 1);
            }
          }
          deleteOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "delete",
            );
            const resolvedIndex = resolveInBoundsIndex(
              arr,
              index,
              selector,
              "delete",
            );
            arr.splice(resolvedIndex, 1);
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
          getOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "get",
            );
            const index = findIdIndex(arr, id);
            return index >= 0 ? arr[index] : null;
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
          setOrThrow(value: unknown, context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "set",
            );
            const index = requireIdIndex(arr, id, selector, "set");
            arr[index] = value;
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
          deleteOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "delete",
            );
            const index = requireIdIndex(arr, id, selector, "delete");
            arr.splice(index, 1);
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
          getOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "get",
            );
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
          setOrThrow(value: unknown, context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "set",
            );
            if (proj) {
              for (const element of arr) {
                proj.setOrThrow(value, element, rootContext);
              }
            } else {
              replaceArray(arr, asArray(value));
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
          deleteOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "delete",
            );
            if (proj) {
              for (const element of arr) {
                proj.deleteOrThrow(element, rootContext);
              }
            } else {
              arr.length = 0;
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
          getOrThrow(context: unknown, rootContext = context) {
            const obj = requireObjectParent(
              base.getOrThrow(context, rootContext),
              selector,
              "get",
            );
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
          setOrThrow(value: unknown, context: unknown, rootContext = context) {
            const obj = requireObjectParent(
              base.getOrThrow(context, rootContext),
              selector,
              "set",
            );
            if (proj) {
              for (const v of Object.values(obj)) {
                proj.setOrThrow(value, v, rootContext);
              }
            } else {
              for (const key of Object.keys(obj)) {
                obj[key] = value;
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
          deleteOrThrow(context: unknown, rootContext = context) {
            const obj = requireObjectParent(
              base.getOrThrow(context, rootContext),
              selector,
              "delete",
            );
            if (proj) {
              for (const v of Object.values(obj)) {
                proj.deleteOrThrow(v, rootContext);
              }
            } else {
              for (const key of Object.keys(obj)) {
                delete obj[key];
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
          getOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "get",
            );
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
          setOrThrow(value: unknown, context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "set",
            );
            replaceArray(
              arr,
              invertedFilter(arr, condition, {
                ...options,
                rootContext,
              }).concat(asArray(value)),
            );
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
          deleteOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "delete",
            );
            replaceArray(
              arr,
              invertedFilter(arr, condition, {
                ...options,
                rootContext,
              }),
            );
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
          getOrThrow(context: unknown, rootContext = context) {
            const value = requireArrayOrStringParent(
              base.getOrThrow(context, rootContext),
              selector,
              "get",
            );
            return slice(value, start, end, step);
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
          setOrThrow(value: unknown, context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "set",
            );
            replaceArray(
              arr,
              invertedSlice(arr, start, end, step).concat(asArray(value)),
            );
          }
          delete(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              replaceArray(arr, invertedSlice(arr, start, end, step));
            }
          }
          deleteOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "delete",
            );
            replaceArray(arr, invertedSlice(arr, start, end, step));
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
          getOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "get",
            );
            return flatten(arr);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              replaceArray(arr, asArray(value));
            }
          }
          setOrThrow(value: unknown, context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "set",
            );
            replaceArray(arr, asArray(value));
          }
          delete(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              arr.length = 0;
            }
          }
          deleteOrThrow(context: unknown, rootContext = context) {
            const arr = requireArrayParent(
              base.getOrThrow(context, rootContext),
              selector,
              "delete",
            );
            arr.length = 0;
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
      arithmetic(selector) {
        const la = makeAccessorInternal(selector.lhs, options);
        const ra = makeAccessorInternal(selector.rhs, options);
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            return performArithmetic(
              la.get(context, rootContext),
              ra.get(context, rootContext),
              selector.operator,
            );
          }
        };
        return new Accessor();
      },
      unaryArithmetic(selector) {
        const base = makeAccessorInternal(selector.expression, options);
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            return performUnaryArithmetic(
              base.get(context, rootContext),
              selector.operator,
            );
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
          getOrThrow(context: unknown, rootContext = context) {
            const lv = la.getOrThrow(context, rootContext);
            return ra.getOrThrow(lv, rootContext);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const lv = la.get(context, rootContext);
            ra.set(value, lv, rootContext);
          }
          setOrThrow(value: unknown, context: unknown, rootContext = context) {
            const lv = la.getOrThrow(context, rootContext);
            ra.setOrThrow(value, lv, rootContext);
          }
          delete(context: unknown, rootContext = context) {
            const lv = la.get(context, rootContext);
            ra.delete(lv, rootContext);
          }
          deleteOrThrow(context: unknown, rootContext = context) {
            const lv = la.getOrThrow(context, rootContext);
            ra.deleteOrThrow(lv, rootContext);
          }
        };
        return new Accessor();
      },
      functionCall(selector) {
        return new EvaluateAccessor(selector, options);
      },
      expressionRef(selector) {
        // Expression references are only meaningful as function arguments
        return new ConstantAccessor(selector, null);
      },
      variableRef(selector) {
        return new EvaluateAccessor(selector, options);
      },
      let(selector) {
        return new EvaluateAccessor(selector, options);
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
