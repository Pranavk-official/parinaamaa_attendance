// Runs synchronously in the browser before React hydration or RSC streaming
// starts processing. Dev-only patch from vercel/next.js#86060: React's flight
// instrumentation measures a rejected/aborted server component (a guard page
// that throws) with an unset end time and crashes `performance.measure` with
// "cannot have a negative time stamp". Swallow only that error.
if (process.env.NODE_ENV === "development") {
  const original = performance.measure.bind(performance);
  performance.measure = ((...args: Parameters<typeof original>) => {
    try {
      return original(...args);
    } catch (e) {
      if (e instanceof Error && e.message.includes("negative time stamp")) {
        return undefined as unknown as PerformanceMeasure;
      }
      throw e;
    }
  }) as typeof performance.measure;
}