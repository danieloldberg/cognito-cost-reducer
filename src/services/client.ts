import { ClientRequest, type Client } from "../schema";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  createClientRequestHash,
  generateIdentifier,
} from "../helpers/identifiers";
import { jwtDecode } from "jwt-decode";

export type createClientRequestPayload = Pick<
  Client,
  "clientName" | "expireDate" | "expireDateEpoch" | "team" | "service"
>;

export const createClient = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  client: createClientRequestPayload
): Promise<Client | undefined> => {
  try {
    const clientId = generateIdentifier(26).identifier;
    const { identifier: clientSecret, hash: clientSecretHash } =
      generateIdentifier(51);

    const results = await dynamoClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `CLIENT#${clientId}`,
          SK: "DETAILS",
          clientId: clientId,
          clientSecret: clientSecret, // TODO: Should be removed, just for testing
          clientSecretHash: clientSecretHash,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...client,
        },
      })
    );

    // TODO: Add to parameter store the clientId and clientSecret

    return results.Attributes as Client;
  } catch (error) {
    console.error("Error creating client:", error);
    return undefined;
  }
};

export const getClient = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  clientId: string
): Promise<Client[] | undefined> => {
  try {
    const results = await dynamoClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditions: {
          PK: {
            ComparisonOperator: "EQ",
            AttributeValueList: [`CLIENT#${clientId}`],
          },
          SK: {
            ComparisonOperator: "EQ",
            AttributeValueList: ["DETAILS"],
          },
        },
      })
    );
    return results.Items as Client[];
  } catch (error) {
    console.error("Error fetching clients:", error);
    return undefined;
  }
};

export const getClientUsingCredentials = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  clientId: string,
  clientSecretHash: string
): Promise<Client | undefined> => {
  try {
    const results = await dynamoClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "validationIndex",
        KeyConditions: {
          clientId: {
            ComparisonOperator: "EQ",
            AttributeValueList: [`${clientId}`],
          },
          clientSecretHash: {
            ComparisonOperator: "EQ",
            AttributeValueList: [clientSecretHash],
          },
        },
      })
    );
    return (results.Items && (results.Items[0] as Client)) || undefined;
  } catch (error) {
    console.error("Error fetching clients:", error);
    return undefined;
  }
};

export const createClientCachedRequest = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  clientId: string,
  clientSecret: string,
  scope: string,
  accessToken: string,
  expiresIn: number
): Promise<void> => {
  try {
    const requestHash = createClientRequestHash(clientId, clientSecret, scope);

    const decodedToken = jwtDecode(accessToken);

    const clientRequest: ClientRequest = {
      clientId: clientId,
      clientSecret: clientSecret,
      scope: scope,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessToken: accessToken,
      accessTokenExpireDate: new Date(decodedToken.exp! * 1000).toISOString(),
      accessTokenExpireDateEpoch: decodedToken.exp!.toString() || "",
      accessTokenExpiresIn: expiresIn.toString(),
    };

    const results = await dynamoClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `CLIENT#REQUESTHASH`,
          SK: `${clientId}#${requestHash}`,
          ...clientRequest,
        },
      })
    );
  } catch (error) {
    console.error("Error creating client request:", error);
    return undefined;
  }
};

export const getClientCachedRequest = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<ClientRequest | undefined> => {
  try {
    const requestHash = createClientRequestHash(clientId, clientSecret, scope);

    const results = await dynamoClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditions: {
          PK: {
            ComparisonOperator: "EQ",
            AttributeValueList: [`CLIENT#REQUESTHASH`],
          },
          SK: {
            ComparisonOperator: "EQ",
            AttributeValueList: [`${clientId}#${requestHash}`],
          },
        },
        FilterExpression: "#accessTokenExpireDate > :compareDate",
        ExpressionAttributeNames: {
          "#accessTokenExpireDate": "accessTokenExpireDate",
        },
        ExpressionAttributeValues: {
          ":compareDate": new Date().toISOString(),
        },
      })
    );
    return results.Items ? (results.Items[0] as ClientRequest) : undefined;
  } catch (error) {
    console.error("Error fetching client request:", error);
    return undefined;
  }
};

// Example usage

// import { dynamoDBClient } from "../adapters/clients";

// (async () => {
//   const tableName = "ClientTable";

//   // Example usage of createClient
//   const newClient = await createClient(dynamoDBClient, tableName, {
//     clientName: "test",
//     expireDate: new Date().toISOString(),
//     expireDateEpoch: Date.now().toString(),
//     team: "Test Team",
//     service: "Test Service",
//   });
//   console.log("Created Client:", newClient);
// })();
