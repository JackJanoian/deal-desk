type WatchdogLogger = {
  error(context: Record<string, unknown>, message: string): void;
};

type StopWatchdog = () => void;

export function startEmbeddedPostgresLivenessWatchdog(opts: {
  probe: () => Promise<unknown>;
  logger: WatchdogLogger;
  exit?: (code: number) => never;
  intervalMs?: number;
}): StopWatchdog {
  const exit = opts.exit ?? process.exit;
  const intervalMs = opts.intervalMs ?? 10_000;
  let probeInFlight = false;

  const timer = setInterval(() => {
    if (probeInFlight) return;
    probeInFlight = true;
    void opts.probe()
      .catch((err) => {
        opts.logger.error({ err }, "Embedded PostgreSQL became unreachable; exiting DealDesk server");
        exit(1);
      })
      .finally(() => {
        probeInFlight = false;
      });
  }, intervalMs);
  timer.unref?.();

  return () => clearInterval(timer);
}
