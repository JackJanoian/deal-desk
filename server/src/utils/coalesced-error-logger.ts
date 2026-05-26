type ErrorLogger = {
  error(context: Record<string, unknown>, message: string): void;
};

type CoalescedErrorLogFn = (err: unknown, message: string) => void;

export function createCoalescedErrorLogger(opts: {
  logger: ErrorLogger;
  intervalMs: number;
  now?: () => number;
}): CoalescedErrorLogFn {
  const now = opts.now ?? Date.now;
  const lastLoggedAtByMessage = new Map<string, number>();
  const suppressedByMessage = new Map<string, number>();

  return (err: unknown, message: string) => {
    const current = now();
    const lastLoggedAt = lastLoggedAtByMessage.get(message);
    if (lastLoggedAt !== undefined && current - lastLoggedAt < opts.intervalMs) {
      suppressedByMessage.set(message, (suppressedByMessage.get(message) ?? 0) + 1);
      return;
    }

    lastLoggedAtByMessage.set(message, current);
    const suppressedCount = suppressedByMessage.get(message) ?? 0;
    suppressedByMessage.set(message, 0);

    opts.logger.error(
      {
        err,
        ...(suppressedCount > 0 ? { suppressedCount } : {}),
      },
      message,
    );
  };
}
