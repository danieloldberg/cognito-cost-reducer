import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

type ScopeMapping = {
  clientId: string;
  scope: string;
};

export const addClientScope = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  clientId: string,
  scope: string
): Promise<ScopeMapping | undefined> => {
  try {
    const results = await dynamoClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `CLIENT#SCOPE`,
          SK: `${clientId}#${scope}`,
          clientId: clientId,
          scope: scope,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );

    return results.Attributes as ScopeMapping;
  } catch (error) {
    console.error("Error adding scope to client:", error);
    return undefined;
  }
};

export const getClientScope = async (
  dynamoClient: DynamoDBDocumentClient,
  tableName: string,
  clientId: string,
  scope: string | undefined
): Promise<ScopeMapping[] | undefined> => {
  const skComparisonOperator = scope ? "EQ" : "BEGINS_WITH";
  const skAttributeValue = scope ? `${clientId}#${scope}` : `${clientId}#`;

  try {
    const results = await dynamoClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditions: {
          PK: {
            ComparisonOperator: "EQ",
            AttributeValueList: [`CLIENT#SCOPE`],
          },
          SK: {
            ComparisonOperator: skComparisonOperator,
            AttributeValueList: [skAttributeValue],
          },
        },
      })
    );

    return results.Items ? (results.Items as ScopeMapping[]) : undefined;
  } catch (error) {
    console.error("Error getting scope:", error);
    return undefined;
  }
};

export const validateScopes = (
  requestedScopes: string[],
  clientScopes: string[]
): boolean => {
  const requestedScopesSet = new Set(requestedScopes);
  const clientScopesSet = new Set(clientScopes);
  for (const scope of requestedScopesSet) {
    if (!clientScopesSet.has(scope)) {
      console.debug(`Scope ${scope} is not valid for this client.`);
      return false;
    }
  }
  return true;
};

// Example usage

// import { dynamoDBClient } from "../adapters/clients";

// (async () => {
//   const tableName = "ClientTable";

//   // Example usage of addClientScope
//   const addedScope = await addClientScope(
//     dynamoDBClient,
//     tableName,
//     "clientId",
//     "user:read"
//   );
//   console.log("Created Client:", addedScope);
// })();
