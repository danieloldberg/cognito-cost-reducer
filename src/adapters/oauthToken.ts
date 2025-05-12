import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "node:querystring";
import {
  createClientCachedRequest,
  getClientCachedRequest,
  getClientUsingCredentials,
} from "../services/client";
import { createSecureHash } from "../helpers/identifiers";
import { CognitoAccessToken } from "../schema";
import { dynamoDBClient } from "./clients";
import { initiateM2MAuth } from "./cognito";
import { getClientScope, validateScopes } from "../services/scope";

export const oauthTokenPost = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const body = parse(event.body || "{}");
  const queryParameters = event.queryStringParameters;
  const requestedScopes =
    queryParameters?.scope?.split(" ") ||
    (typeof body?.scope === "string"
      ? body.scope.split(" ")
      : Array.isArray(body?.scope)
      ? body.scope
      : []);
  const headers = event.headers;

  let {
    grant_type: grantType,
    client_id: clientId,
    client_secret: clientSecret,
  } = body;

  if (grantType !== "client_credentials") {
    return {
      statusCode: 400,
      body: JSON.stringify({ status: "grant_type not supported" }), // TODO: Just proxy request to Cognito
    };
  }

  if (!clientId || !clientSecret) {
    const authHeader = headers["Authorization"] || headers["authorization"];
    if (!authHeader) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: "Credentials not provided",
        }),
      };
    }

    const [authType, authValue] = authHeader.split(" ");
    if (authType === "Basic") {
      const decodedValue = Buffer.from(authValue, "base64").toString("utf-8");
      [clientId, clientSecret] = decodedValue.split(":");
      if (!clientId || !clientSecret) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            status: "Credentials not provided",
          }),
        };
      }
    }
  }

  const validClientPromise = getClientUsingCredentials(
    dynamoDBClient,
    process.env.TABLE_NAME as string,
    clientId as string,
    createSecureHash(clientSecret as string)
  );

  const clientScopesPromise = getClientScope(
    dynamoDBClient,
    process.env.TABLE_NAME as string,
    clientId as string,
    undefined
  );

  const existingClientRequestPromise = getClientCachedRequest(
    dynamoDBClient,
    process.env.TABLE_NAME as string,
    clientId as string,
    clientSecret as string,
    requestedScopes.join(" ")
  );

  const [validClient, clientScopeMapping, existingClientRequest] =
    await Promise.all([
      validClientPromise,
      clientScopesPromise,
      existingClientRequestPromise,
    ]);

  if (!validClient) {
    return {
      statusCode: 401,
      body: JSON.stringify({ status: "Invalid client credentials" }),
    };
  }

  if (existingClientRequest) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        access_token: existingClientRequest.accessToken,
        expires_in: Number(existingClientRequest.accessTokenExpiresIn),
        token_type: "Bearer",
      }),
    };
  }

  const clientScopes = clientScopeMapping?.map((scope) => scope.scope) || [];

  if (requestedScopes.length > 0) {
    if (!validateScopes(requestedScopes, clientScopes)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: "Invalid scope",
        }),
      };
    }
  }
  const scopes = requestedScopes.length > 0 ? requestedScopes : clientScopes;

  if (
    validClient.accessToken &&
    Number(validClient.accessTokenExpireDateEpoch) > Date.now()
  ) {
    const returnObject: CognitoAccessToken = {
      access_token: validClient.accessToken,
      expires_in: Number(validClient.accessTokenExpiresIn),
      token_type: "Bearer",
    };
    return {
      statusCode: 200,
      body: JSON.stringify(returnObject),
    };
  }

  // If the access token is empty or expired, we go through the Cognito client credentials flow

  const tokenEndpoint = process.env.COGNITO_TOKEN_ENDPOINT || "";
  const genericClientId = process.env.COGNITO_CLIENT_ID || "";
  const genericClientSecret = process.env.COGNITO_CLIENT_SECRET || "";

  const clientMetadata = {
    clientId: clientId as string,
    scope: scopes.join(" "),
  };

  const cognitoTokenResponse = await initiateM2MAuth(
    tokenEndpoint,
    genericClientId,
    genericClientSecret,
    clientMetadata
  );

  if (!cognitoTokenResponse) {
    return {
      statusCode: 500,
      body: JSON.stringify({ status: "Failed to get access token" }),
    };
  }

  await createClientCachedRequest(
    dynamoDBClient,
    process.env.TABLE_NAME as string,
    clientId as string,
    clientSecret as string,
    scopes.join(" "),
    cognitoTokenResponse.access_token,
    cognitoTokenResponse.expires_in
  );

  return {
    statusCode: 200,
    body: JSON.stringify(cognitoTokenResponse),
  };
};
