import { z } from "zod";

export const tokenRequestbodyPayload = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  grantType: z.string(),
});

export const tokenRequestPayload = z.object({
  queryStringParameters: z.object({
    scope: z.string().optional(),
  }),
  headers: z.object({
    Authorization: z.string().optional(),
  }),
});

export type TokenRequestPayload = z.infer<typeof tokenRequestPayload>;

export const tokenRequestBodyPayload = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  grantType: z.string(),
  scope: z.string().optional(),
});

export const client = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  clientName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expireDate: z.string(),
  expireDateEpoch: z.string(),
  team: z.string(),
  service: z.string(),
  accessToken: z.string().optional(),
  accessTokenExpireDate: z.string().optional(),
  accessTokenExpireDateEpoch: z.string().optional(),
  accessTokenExpiresIn: z.string().optional(),
});

export type Client = z.infer<typeof client>;

const clientRequest = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  scope: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  accessToken: z.string(),
  accessTokenExpireDate: z.string(),
  accessTokenExpireDateEpoch: z.string(),
  accessTokenExpiresIn: z.string(),
});

export type ClientRequest = z.infer<typeof clientRequest>;

export const cognitoAccessToken = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
});

export const accessToken = cognitoAccessToken.extend({
  expireDate: z.string(),
  expireDateEpoch: z.string(),
});

export type CognitoAccessToken = z.infer<typeof cognitoAccessToken>;
export type AccessToken = z.infer<typeof accessToken>;
