// Firefox versions and some embedded webviews may not expose
// Promise.withResolvers even though pdf.js and other modern libraries can use it.
// Install a tiny standards-compatible fallback before the application imports
// components that may evaluate those libraries.
if (typeof Promise !== 'undefined' && !(Promise as any).withResolvers) {
  (Promise as any).withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
