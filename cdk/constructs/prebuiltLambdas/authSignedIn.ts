import { ApiHandler, initApiHandler } from "../../../lambda/handlers/initApiHandler";
import { verifyJwt } from "../../../lambda/helpers/jwt";
import { ApiErrorResponse } from "../../../lambda/interfaces/ApiErrorResponse";

const apiHandler: ApiHandler<never, any | ApiErrorResponse> = async ({
  queryStringParameters,
}) => {
  const { id_token, expires_in } = queryStringParameters;
  if (!id_token || !expires_in) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*", // Required for CORS support to work
      } as Record<string, string>,
      data: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting...</title>
    <script type="module">
        function convertFragmentToQuery() {
        // Get the current URL
        const url = new URL(window.location.href);
        
        // Extract the fragment (after the #)
        const fragment = url.hash.substring(1); // Remove the '#'
        
        if (!fragment) return; // No fragment, no need to redirect
        
        // Convert fragment key-value pairs into query parameters
        const queryParams = new URLSearchParams();
        
        fragment.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) queryParams.append(key, value || '');
        });

        // Construct new URL with query parameters instead of fragment
        url.hash = ''; // Remove the fragment
        url.search = queryParams.toString(); // Set query params

        // Redirect to the new URL if different
        if (window.location.href !== url.toString()) {
            window.location.replace(url.toString());
        }
    }

    // Run the function when the page loads
    window.addEventListener('load', convertFragmentToQuery);
    </script>
</head>
<body>
    <p>Redirecting...</p>
</body>
</html>`,
    };
  }

  let username = "";
  let email = "";
  try {
    if (!id_token) {
      throw new Error("No ID token provided");
    }

    const decodedJwt = await verifyJwt(id_token);
    username = decodedJwt["cognito:username"] || "";
    email = decodedJwt.email || "";
  } catch (e) {
    const message = "Error verifying JWT token";
    return {
      statusCode: 401, // Unauthorized
      data: { message },
    };
  }

  try {
    const redirectUrl = `${process.env.REDIRECT_URL}?idToken=${id_token}&expiresIn=${expires_in}`;
    const url = new URL(redirectUrl);
    const baseDomain = url.hostname.split('.').slice(-2).join('.');

    return {
      statusCode: 200, // OK
      headers: {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
        "Set-Cookie": `email=${email}; idToken=${id_token}; expires=${new Date(
          Date.now() + 1000 * parseInt(expires_in)
        ).toUTCString()}; Domain=${baseDomain}; Secure; HttpOnly; SameSite=None` || "",
      },
      data: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0; url=${redirectUrl}">
    <title>Redirecting...</title>
</head>
<body>
    <p>If you are not redirected, <a href="${redirectUrl}">click here</a>.</p>
</body>
</html>`,
    };
  } catch (e) {
    const message = "Error retrieving API key";
    return {
      statusCode: 500, // Internal Server Error
      data: { message },
    };
  }
};

export const handler = initApiHandler({
  apiHandler,
  errorOutput: {},
});
