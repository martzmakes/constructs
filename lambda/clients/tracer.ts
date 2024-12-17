import { Tracer } from "@aws-lambda-powertools/tracer";

let cachedTracer: Tracer;

export const getTracer = (name?: string) => {
  const serviceName = name || process.env.EVENT_SOURCE;

  if (!serviceName) {
    throw new Error(
      "Service name is required as a parameter or in the EVENT_SOURCE environment variable."
    );
  }

  if (!cachedTracer) {
    cachedTracer = new Tracer({ serviceName });
  }

  return cachedTracer;
};
