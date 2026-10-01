/** Prevent an earlier identity or request from publishing into the current view. */
export function createRequestGuard() {
  let version = 0;
  return {
    begin: () => ++version,
    isCurrent: (request: number) => request === version,
    hasStarted: () => version > 0,
    invalidate: () => {
      version++;
    },
  };
}
