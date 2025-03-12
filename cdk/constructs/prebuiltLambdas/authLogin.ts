import { ApiHandler, initApiHandler } from "../../../lambda/handlers/initApiHandler";
import { ApiErrorResponse } from "../../../lambda/interfaces/ApiErrorResponse";

const signInUrl = process.env.SIGN_IN_URL;

const apiHandler: ApiHandler<never, any|ApiErrorResponse> = async () => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html",
      "Access-Control-Allow-Origin": "*", // Required for CORS support to work
    },
    data: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0; url=${signInUrl}">
    <title>Redirecting...</title>
</head>
<body>
    <p>If you are not redirected, <a href="${signInUrl}">click here</a>.</p>
</body>
</html>`,
  };
}

export const handler = initApiHandler({
  apiHandler,
  errorOutput: {},
});
