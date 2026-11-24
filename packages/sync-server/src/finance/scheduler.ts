/** Poll while the server runs, including overdue work immediately after a restart. */
export function scheduleFinanceSync(tick: () => Promise<void>) {
  let running = false;
  let stopped = false;
  async function run() {
    if (running || stopped) return;
    running = true;
    try {
      await tick();
    } catch {
      // Retain saved state and retry on the next poll.
    } finally {
      running = false;
    }
  }
  const timer = setInterval(() => void run(), 60000);
  timer.unref();
  void run();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
