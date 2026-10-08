// Synchronous press guards complement pointerEvents, which updates on React's commit.
export function createInteractionLock(onChange: (locked: boolean) => void) {
  const owners = new Set<symbol>();
  return {
    isLocked: () => owners.size > 0,
    acquire() {
      const owner = Symbol('scrub');
      owners.add(owner); onChange(true);
      return () => {
        if (owners.delete(owner)) onChange(owners.size > 0);
      };
    },
  };
}
