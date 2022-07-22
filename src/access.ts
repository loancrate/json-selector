import { JsonSelector } from "./types";
import { formatIdentifier, formatRawString, isArray, isObject } from "./util";
import { visitJsonSelector } from "./visitor";

export interface Accessor<T> {
  readonly valid: boolean;
  readonly path: string;
  get(): T;
  set(value: T): void;
  delete(): void;
}

function getInvalidAccessor(path: string): Accessor<unknown> {
  return {
    valid: false,
    path,
    get() {
      return undefined;
    },
    set(_) {
      // ignored
    },
    delete() {
      // ignored
    },
  };
}

export function accessWithJsonSelector(
  selector: JsonSelector,
  context: unknown
): Accessor<unknown> {
  return visitJsonSelector<Accessor<unknown>, unknown>(
    selector,
    {
      identifier({ id }, context) {
        const path = formatIdentifier(id);
        if (isObject(context)) {
          return {
            valid: true,
            path,
            get() {
              return context[id];
            },
            set(v) {
              context[id] = v;
            },
            delete() {
              delete context[id];
            },
          };
        }
        return getInvalidAccessor(path);
      },
      fieldAccess({ expression, field }) {
        const accessor = visitJsonSelector<Accessor<unknown>, unknown>(
          expression,
          this,
          context
        );
        if (accessor.valid) {
          const path = `${accessor.path}.${formatIdentifier(field)}`;
          const expression = accessor.get();
          if (isObject(expression)) {
            return {
              valid: true,
              path,
              get() {
                return expression[field];
              },
              set(v) {
                expression[field] = v;
              },
              delete() {
                delete expression[field];
              },
            };
          }
          return getInvalidAccessor(path);
        }
        return accessor;
      },
      idAccess({ expression, id }, context) {
        const accessor = visitJsonSelector<Accessor<unknown>, unknown>(
          expression,
          this,
          context
        );
        if (accessor.valid) {
          const path = `${accessor.path}[${formatRawString(id)}]`;
          const expression = accessor.get();
          if (isArray(expression)) {
            return {
              valid: true,
              path,
              get() {
                return expression.find(
                  (element) => isObject(element) && element.id === id
                );
              },
              set(v) {
                const index = expression.findIndex(
                  (element) => isObject(element) && element.id === id
                );
                if (index >= 0) {
                  expression[index] = v;
                }
              },
              delete() {
                const index = expression.findIndex(
                  (element) => isObject(element) && element.id === id
                );
                if (index >= 0) {
                  expression.splice(index, 1);
                }
              },
            };
          }
          return getInvalidAccessor(accessor.path);
        }
        return accessor;
      },
      indexAccess({ expression, index }, context) {
        const accessor = visitJsonSelector<Accessor<unknown>, unknown>(
          expression,
          this,
          context
        );
        if (accessor.valid) {
          const path = `${accessor.path}[${index}]`;
          const expression = accessor.get();
          if (isArray(expression)) {
            return {
              valid: true,
              path,
              get() {
                return expression[index];
              },
              set(v) {
                expression[index] = v;
              },
              delete() {
                expression.splice(index, 1);
              },
            };
          }
          return getInvalidAccessor(path);
        }
        return accessor;
      },
    },
    context
  );
}
