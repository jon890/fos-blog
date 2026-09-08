const MAX_DEADLOCK_RETRIES = 2;

function isDeadlockError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current !== null; depth += 1) {
    if (typeof current !== "object") return false;
    const candidate = current as {
      code?: unknown;
      errno?: unknown;
      sqlState?: unknown;
      cause?: unknown;
    };
    if (
      candidate.code === "ER_LOCK_DEADLOCK" ||
      candidate.errno === 1213 ||
      candidate.sqlState === "40001"
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export async function retryDeadlockedTransaction<T>(
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_DEADLOCK_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isDeadlockError(error) || attempt === MAX_DEADLOCK_RETRIES) throw error;
    }
  }
  throw new Error("deadlock 재시도 횟수를 벗어났습니다.");
}
