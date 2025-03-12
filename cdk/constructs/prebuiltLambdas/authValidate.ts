import {
  ApiHandler,
  initApiHandler,
} from "../../../lambda/handlers/initApiHandler";
import { verifyJwt } from "../../../lambda/helpers/jwt";
import { ApiErrorResponse } from "../../../lambda/interfaces/ApiErrorResponse";

const apiHandler: ApiHandler<
  { idToken: string },
  any | ApiErrorResponse
> = async ({ body }) => {
  const { idToken } = body;
  try {
    if (!idToken) {
      throw new Error("No ID token provided");
    }

    const decodedJwt = await verifyJwt(idToken);
    console.log("Decoded JWT: ", JSON.stringify({ decodedJwt }));
    return {
      statusCode: 200,
      data: {
        valid: true,
      },
    };
  } catch (e) {
    const message = `Error verifying JWT token: ${e}`;
    console.error(message);
    return {
      statusCode: 200,
      data: { valid: false },
    };
  }
};

export const handler = initApiHandler({
  apiHandler,
  errorOutput: {},
});
