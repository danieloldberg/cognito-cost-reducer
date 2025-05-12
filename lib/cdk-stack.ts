import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Runtime,
  LoggingFormat,
  ApplicationLogLevel,
  Architecture,
} from "aws-cdk-lib/aws-lambda";
import {
  AttributeType,
  ProjectionType,
  TableV2,
} from "aws-cdk-lib/aws-dynamodb";
import {
  NodejsFunction,
  NodejsFunctionProps,
  OutputFormat,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { join } from "path";
import {
  AuthorizationType,
  LambdaIntegration,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  LambdaVersion,
  UserPool,
  UserPoolOperation,
} from "aws-cdk-lib/aws-cognito";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class CognitoCostReducer extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const userPool = new UserPool(this, "UserPool", {
      userPoolName: "CognitoCostReducerUserPool",
      selfSignUpEnabled: false,
    });

    const clientTable = new TableV2(this, "ClientTable", {
      tableName: `ClientTable`,
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "SK",
        type: AttributeType.STRING,
      },
    });

    clientTable.addGlobalSecondaryIndex({
      indexName: "validationIndex",
      partitionKey: {
        name: "clientId",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "clientSecretHash",
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.INCLUDE,
      nonKeyAttributes: [
        "clientId",
        "expireDate",
        "expireDateEpoch",
        "accessToken",
      ],
    });

    const defaultNodeJsFunctionProps: NodejsFunctionProps = {
      runtime: Runtime.NODEJS_22_X,
      loggingFormat: LoggingFormat.JSON,
      logRetention: 30,
      applicationLogLevelV2: ApplicationLogLevel.INFO,
      memorySize: 512,
      timeout: Duration.minutes(1),
      architecture: Architecture.ARM_64,
      bundling: {
        format: OutputFormat.ESM,
        mainFields: ["module", "main"],
        esbuildArgs: {
          "--conditions": "module",
          "--tree-shaking": "true",
        },
      },
      environment: {},
    };

    const mainLambda = new NodejsFunction(this, "mainLambda", {
      projectRoot: join(__dirname, "../"),
      entry: join(__dirname, "../src/adapters/router.ts"),
      depsLockFilePath: join(__dirname, "../pnpm-lock.yaml"),
      ...defaultNodeJsFunctionProps,
      environment: {
        ...defaultNodeJsFunctionProps.environment,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        TABLE_NAME: clientTable.tableName,
      },
    });

    clientTable.grantReadWriteData(mainLambda);

    const api = new RestApi(this, "CognitoCostReducerApi", {
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
    });

    const oauth2Resource = api.root.addResource("oauth2");

    const tokenResource = oauth2Resource.addResource("token");
    tokenResource.addMethod("POST", new LambdaIntegration(mainLambda), {
      authorizationType: AuthorizationType.NONE,
    });

    const preTokenGenerationLambda = new NodejsFunction(
      this,
      "preTokenGenerationLambda",
      {
        projectRoot: join(__dirname, "../"),
        entry: join(__dirname, "../src/adapters/cognito/preTokenGeneration.ts"),
        depsLockFilePath: join(__dirname, "../pnpm-lock.yaml"),
        ...defaultNodeJsFunctionProps,
        environment: {
          ...defaultNodeJsFunctionProps.environment,
          TABLE_NAME: clientTable.tableName,
        },
      }
    );
    clientTable.grantReadData(preTokenGenerationLambda);

    userPool.addTrigger(
      UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
      preTokenGenerationLambda,
      LambdaVersion.V3_0
    );
  }
}
