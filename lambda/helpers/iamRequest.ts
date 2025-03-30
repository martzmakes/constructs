import { HttpRequest } from "@smithy/protocol-http";
import { decodePossiblyLargePayload } from "./decodePayload";
import { signRequest } from "./sign-request";

/**
 * Makes a signed IAM request and decodes its payload.
 *
 * This function builds an HTTP request based on the provided parameters,
 * signs it via the IAM signing mechanism, and sends it using `fetch`.
 * It logs the input arguments and the constructed request for debugging purposes.
 *
 * If the response is not successful (i.e. `res.ok` is false) and its status code is not among the allowedStatusCodes (default is [404]),
 * the function throws an error containing the response details.
 *
 * If the response is successful, the response JSON is passed to `decodePossiblyLargePayload`
 * to handle any large payload decoding, and the decoded result is returned.
 *
 * @template T - The expected type of the decoded response.
 * @param args - The request parameters.
 * @param args.allowedStatusCodes - Optional array of HTTP status codes that are acceptable (defaults to [404]).
 * @param args.body - Optional request body (string).
 * @param args.domain - The domain to which the request is made (e.g. "example.com" or "https://example.com").
 * @param args.headers - Optional headers to include in the request.
 * @param args.method - The HTTP method to use (defaults to "GET").
 * @param args.path - The path for the request.
 * @param args.query - Optional query parameters for the request.
 * @returns A promise that resolves to the decoded response (of type T) or an empty object if an allowed status code is returned.
 * @throws Will throw an error if required parameters are missing or if the response has an unexpected status.
 *
 * @example
 * ```typescript
 * const result = await iamRequest<MyResponseType>({
 *   domain: "https://api.example.com",
 *   path: "endpoint",
 *   method: "POST",
 *   body: JSON.stringify({ key: "value" }),
 *   headers: { "X-Custom-Header": "value" },
 *   query: { q: "search" },
 * });
 * console.log(result);
 * ```
 */
export const iamRequest = async <T>(args: {
  allowedStatusCodes?: number[];
  body?: string;
  domain: string;
  headers?: Record<string, string>;
  method?: string;
  path: string;
  query?: Record<string, string | Array<string> | null>;
}): Promise<{} | T> => {
  try {
    console.info({ message: `args`, data: { args } });
    if (!args.domain) {
      throw new Error("No domain provided");
    }
    if (!args.path) {
      throw new Error("No path provided");
    }

    const { domain: incomingDomain, method, path, query } = args;
    const cleanDomain = incomingDomain.replace("https://", "");
    const domain = cleanDomain.endsWith("/")
      ? cleanDomain.slice(0, -1)
      : cleanDomain;

    const url = new URL(`https://${domain}/${path}`);
    const request = new HttpRequest({
      hostname: url.host,
      method: method || "GET",
      headers: {
        host: url.host,
        ...(args.body ? { "Content-Type": "application/json" } : {}),
        sourceFn: process.env.AWS_LAMBDA_FUNCTION_NAME || "",
        ...args.headers,
      },
      path: url.pathname,
      body: args.body,
      query: query,
    });

    console.info({ message: `request`, data: { request } });
    const signedRequest = await signRequest(request);

    const reqUrl = new URL(url.href);
    reqUrl.search = new URLSearchParams(
      query as Record<string, string>
    ).toString();

    const res = await fetch(`${url.href}${reqUrl.search}`, signedRequest);
    if (!res.ok) {
      const allowedStatusCodes = args.allowedStatusCodes || [404];
      if (!allowedStatusCodes.includes(res.status)) {
        const text = await res.text();
        throw new Error(
          `Error making IAM request - status: ${res.status} (${res.statusText}), reason: ${text}`
        );
      }
      return {};
    }

    const resJson = await res.json();
    const decoded = await decodePossiblyLargePayload({ payload: resJson });
    return decoded as T;
  } catch (e) {
    console.error({
      message: `Error making IAM request`,
      error: e as Error,
      data: {
        args,
      },
    });
    throw e;
  }
};
