import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { oauthTokenPost } from "./oauthToken";

class Router {
  private routes: {
    [key: string]: (
      event: APIGatewayProxyEvent
    ) => Promise<APIGatewayProxyResult>;
  };

  constructor() {
    this.routes = {};
  }

  addRoute(
    path: string,
    method: string,
    handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
  ): void {
    const key = `${path} ${method}`;
    if (!this.routes[key]) {
      this.routes[key] = handler;
    }
  }

  async handleRequest(
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    const path = event.path.toLowerCase();
    const method = event.httpMethod.toUpperCase();
    const key = `${path} ${method}`;
    const handler = this.routes[key];

    if (handler) {
      return await handler(event);
    } else {
      throw new Error(`Unhandled path: ${path} with method: ${method}`);
    }
  }
}

const router = new Router();
router.addRoute("/oauth2/token", "POST", oauthTokenPost);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const response = await router.handleRequest(event);
  return response;
};
