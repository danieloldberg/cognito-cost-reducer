import { CognitoAccessToken } from "../../schema";

export const initiateM2MAuth = async (
  tokenEndpoint: string,
  clientId: string,
  clientSecret: string,
  clientMetadata: Record<string, unknown>
) => {
  const payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      aws_client_metadata: JSON.stringify(clientMetadata),
    }),
  };
  const response = await fetch(tokenEndpoint, payload);

  if (!response.ok) {
    throw new Error(
      `Failed to initiate client_credentials authentication flow: ${
        response.statusText
      } ${await response.text()}`
    );
  }

  const body = (await response.json()) as CognitoAccessToken;

  return body;
};
