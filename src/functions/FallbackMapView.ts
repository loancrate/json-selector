/**
 * Read-only {@link Map} view that layers a primary map over an optional fallback,
 * with primary entries taking precedence on key collisions.
 */
export class FallbackMapView<K, V extends {}> implements ReadonlyMap<K, V> {
  constructor(
    protected readonly primary: ReadonlyMap<K, V>,
    protected readonly fallback?: ReadonlyMap<K, V>,
  ) {}

  get(name: K): V | undefined {
    return this.primary.get(name) ?? this.fallback?.get(name);
  }

  has(name: K): boolean {
    return this.primary.has(name) || this.fallback?.has(name) === true;
  }

  get size(): number {
    let result = this.primary.size;
    if (this.fallback) {
      for (const k of this.fallback.keys()) {
        if (!this.primary.has(k)) {
          ++result;
        }
      }
    }
    return result;
  }

  *entries(): MapIterator<[K, V]> {
    for (const [k, v] of this.primary) {
      yield [k, v];
    }
    if (this.fallback) {
      for (const [k, v] of this.fallback) {
        if (!this.primary.has(k)) {
          yield [k, v];
        }
      }
    }
  }

  *keys(): MapIterator<K> {
    for (const [k] of this.entries()) {
      yield k;
    }
  }

  *values(): MapIterator<V> {
    for (const [, v] of this.entries()) {
      yield v;
    }
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }

  forEach(
    callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown,
  ): void {
    for (const [k, v] of this.entries()) {
      callbackfn.call(thisArg, v, k, this);
    }
  }
}
