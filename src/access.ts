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
  isValidContext(context: unknown): boolean;
  get(context: unknown): unknown;
  set(context: unknown, value: unknown): void;
  delete(context: unknown): void;
}

abstract class BaseAccessor implements UnboundAccessor {
  constructor(readonly selector: JsonSelector) {}
  abstract isValidContext(context: unknown): boolean;
  abstract get(context: unknown): unknown;
  abstract set(context: unknown, value: unknown): void;
  abstract delete(context: unknown): void;
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

export function makeJsonSelectorAccessor(
  selector: JsonSelector
): UnboundAccessor {
  return visitJsonSelector<UnboundAccessor, undefined>(
    selector,
    {
      current() {
        return new ContextAccessor();
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
          set(context: unknown, value: unknown) {
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
          isValidContext(context: unknown) {
            return isObject(base.get(context));
          }
          get(context: unknown) {
            return getField(base.get(context), field);
          }
          set(context: unknown, value: unknown) {
            const obj = base.get(context);
            if (isObject(obj)) {
              obj[field] = value;
            }
          }
          delete(context: unknown) {
            const obj = base.get(context);
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
          isValidContext(context: unknown) {
            return isArray(base.get(context));
          }
          get(context: unknown) {
            return getIndex(base.get(context), index);
          }
          set(context: unknown, value: unknown) {
            const arr = base.get(context);
            if (isArray(arr)) {
              arr[index] = value;
            }
          }
          delete(context: unknown) {
            const arr = base.get(context);
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
          isValidContext(context: unknown) {
            return isArray(base.get(context));
          }
          get(context: unknown) {
            return findId(base.get(context), id);
          }
          set(context: unknown, value: unknown) {
            const arr = base.get(context);
            if (isArray(arr)) {
              const index = findIdIndex(arr, id);
              if (index >= 0) {
                arr[index] = value;
              }
            }
          }
          delete(context: unknown) {
            const arr = base.get(context);
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
          isValidContext(context: unknown) {
            return isArray(base.get(context));
          }
          get(context: unknown) {
            return project(base.get(context), projection);
          }
          set(context: unknown, value: unknown) {
            const arr = base.get(context);
            if (isArray(arr)) {
              if (proj) {
                for (const element of arr) {
                  proj.set(element, value);
                }
              } else {
                replaceArray(arr, asArray(value));
              }
            }
          }
          delete(context: unknown) {
            const arr = base.get(context);
            if (isArray(arr)) {
              if (proj) {
                for (const element of arr) {
                  proj.delete(element);
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
          isValidContext(context: unknown) {
            return isArray(base.get(context));
          }
          get(context: unknown) {
            return filter(base.get(context), condition);
          }
          set(context: unknown, value: unknown) {
            const arr = base.get(context);
            if (isArray(arr)) {
              replaceArray(
                arr,
                invertedFilter(arr, condition).concat(asArray(value))
              );
            }
          }
          delete(context: unknown) {
            const arr = base.get(context);
            if (isArray(arr)) {
              replaceArray(arr, invertedFilter(arr, condition));
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
          isValidContext(context: unknown) {
            return isArray(base.get(context));
          }
          get(context: unknown) {
            return slice(base.get(context), start, end, step);
          }
          set(context: unknown, value: unknown) {
            const arr = base.get(context);
            if (isArray(arr)) {
              replaceArray(
                arr,
                invertedSlice(arr, start, end, step).concat(asArray(value))
              );
            }
          }
          delete(context: unknown) {
            const arr = base.get(context);
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
          isValidContext(context: unknown) {
            return isArray(base.get(context));
          }
          get(context: unknown) {
            return flatten(base.get(context));
          }
          set(context: unknown, value: unknown) {
            const arr = base.get(context);
            if (isArray(arr)) {
              replaceArray(arr, asArray(value));
            }
          }
          delete(context: unknown) {
            const arr = base.get(context);
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
          get(context: unknown) {
            return isFalseOrEmpty(base.get(context));
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
          get(context: unknown) {
            const lv = la.get(context);
            const rv = ra.get(context);
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
          get(context: unknown) {
            const lv = la.get(context);
            return isFalseOrEmpty(lv) ? lv : ra.get(context);
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
          get(context: unknown) {
            const lv = la.get(context);
            return !isFalseOrEmpty(lv) ? lv : ra.get(context);
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
          isValidContext(context: unknown) {
            return ra.isValidContext(la.get(context));
          }
          get(context: unknown) {
            return ra.get(la.get(context));
          }
          set(context: unknown, value: unknown) {
            ra.set(la.get(context), value);
          }
          delete(context: unknown) {
            ra.delete(la.get(context));
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
  context: unknown
): Accessor<unknown> {
  const { selector } = unbound;
  const valid = unbound.isValidContext(context);
  return {
    selector,
    valid,
    path: formatJsonSelector(selector),
    get() {
      return unbound.get(context);
    },
    set(v: unknown) {
      unbound.set(context, v);
    },
    delete() {
      unbound.delete(context);
    },
  };
}

export function accessWithJsonSelector(
  selector: JsonSelector,
  context: unknown
): Accessor<unknown> {
  return bindJsonSelectorAccessor(makeJsonSelectorAccessor(selector), context);
}

function replaceArray(
  target: unknown[],
  source: readonly unknown[]
): unknown[] {
  target.length = 0;
  target.push(...source);
  return target;
}

function invertedFilter(value: unknown[], condition: JsonSelector): unknown[] {
  return value.filter((e) =>
    isFalseOrEmpty(evaluateJsonSelector(condition, e))
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
