import { JsonSelector } from "./ast";
import {
  compare,
  evaluateJsonSelector,
  filter,
  flatten,
  normalizeSlice,
  project,
  slice,
} from "./evaluate";
import { formatJsonSelector } from "./format";
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
  constructor(selector: JsonSelector, readonly value: T) {
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

export function makeJsonSelectorAccessor(
  selector: JsonSelector
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
        const base = makeJsonSelectorAccessor(expression);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            return isObject(base.get(context, rootContext));
          }
          get(context: unknown, rootContext = context) {
            return getField(base.get(context, rootContext), field);
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
        const base = makeJsonSelectorAccessor(expression);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            return isArray(base.get(context, rootContext));
          }
          get(context: unknown, rootContext = context) {
            return getIndex(base.get(context, rootContext), index);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              arr[index] = value;
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
        const base = makeJsonSelectorAccessor(expression);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            return isArray(base.get(context, rootContext));
          }
          get(context: unknown, rootContext = context) {
            return findId(base.get(context, rootContext), id);
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
        const base = makeJsonSelectorAccessor(expression);
        const proj = projection && makeJsonSelectorAccessor(projection);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            return isArray(base.get(context, rootContext));
          }
          get(context: unknown, rootContext = context) {
            return project(base.get(context, rootContext), projection, context);
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
      filter(selector) {
        const { expression, condition } = selector;
        const base = makeJsonSelectorAccessor(expression);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            return isArray(base.get(context, rootContext));
          }
          get(context: unknown, rootContext = context) {
            return filter(base.get(context, rootContext), condition, context);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              replaceArray(
                arr,
                invertedFilter(arr, condition, rootContext).concat(
                  asArray(value)
                )
              );
            }
          }
          delete(context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              replaceArray(arr, invertedFilter(arr, condition, rootContext));
            }
          }
        };
        return new Accessor();
      },
      slice(selector) {
        const { expression, start, end, step } = selector;
        const base = makeJsonSelectorAccessor(expression);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            return isArray(base.get(context, rootContext));
          }
          get(context: unknown, rootContext = context) {
            return slice(base.get(context, rootContext), start, end, step);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            const arr = base.get(context, rootContext);
            if (isArray(arr)) {
              replaceArray(
                arr,
                invertedSlice(arr, start, end, step).concat(asArray(value))
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
        const base = makeJsonSelectorAccessor(expression);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            return isArray(base.get(context, rootContext));
          }
          get(context: unknown, rootContext = context) {
            return flatten(base.get(context, rootContext));
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
        const base = makeJsonSelectorAccessor(expression);
        const Accessor = class extends ReadOnlyAccessor {
          constructor() {
            super(selector);
          }
          get(context: unknown, rootContext = context) {
            return isFalseOrEmpty(base.get(context, rootContext));
          }
        };
        return new Accessor();
      },
      compare(selector) {
        const { lhs, rhs, operator } = selector;
        const la = makeJsonSelectorAccessor(lhs);
        const ra = makeJsonSelectorAccessor(rhs);
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
        const la = makeJsonSelectorAccessor(lhs);
        const ra = makeJsonSelectorAccessor(rhs);
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
        const la = makeJsonSelectorAccessor(lhs);
        const ra = makeJsonSelectorAccessor(rhs);
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
      pipe(selector) {
        const { lhs, rhs } = selector;
        const la = makeJsonSelectorAccessor(lhs);
        const ra = makeJsonSelectorAccessor(rhs);
        const Accessor = class extends BaseAccessor {
          constructor() {
            super(selector);
          }
          isValidContext(context: unknown, rootContext = context) {
            return ra.isValidContext(la.get(context, rootContext), rootContext);
          }
          get(context: unknown, rootContext = context) {
            return ra.get(la.get(context, rootContext), rootContext);
          }
          set(value: unknown, context: unknown, rootContext = context) {
            ra.set(value, la.get(context, rootContext), rootContext);
          }
          delete(context: unknown, rootContext = context) {
            ra.delete(la.get(context, rootContext), rootContext);
          }
        };
        return new Accessor();
      },
    },
    undefined
  );
}

export interface Accessor<T> {
  readonly selector: JsonSelector;
  readonly valid: boolean;
  readonly path: string;
  get(): T;
  set(value: T): void;
  delete(): void;
}

export function bindJsonSelectorAccessor(
  unbound: UnboundAccessor,
  context: unknown,
  rootContext = context
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

export function accessWithJsonSelector(
  selector: JsonSelector,
  context: unknown,
  rootContext = context
): Accessor<unknown> {
  return bindJsonSelectorAccessor(
    makeJsonSelectorAccessor(selector),
    context,
    rootContext
  );
}

function replaceArray(
  target: unknown[],
  source: readonly unknown[]
): unknown[] {
  target.length = 0;
  target.push(...source);
  return target;
}

function invertedFilter(
  value: unknown[],
  condition: JsonSelector,
  rootContext: unknown
): unknown[] {
  return value.filter((e) =>
    isFalseOrEmpty(evaluateJsonSelector(condition, e, rootContext))
  );
}

export function invertedSlice(
  value: unknown[],
  start: number | undefined,
  end?: number,
  step?: number
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
