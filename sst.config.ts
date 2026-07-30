/// <reference path=".sst/platform/config.d.ts" />

export default $config({
  app() {
    return {
      name: "ai-wordbook",
      removal: "retain",
      home: "aws",
      providers: {
        aws: {
          region: "ap-northeast-1",
          profile: "ougi",
        },
      },
    };
  },
  async run() {
    const wordbook = new sst.aws.Dynamo("Wordbook", {
      fields: {
        userId: "string",
        word: "string",
      },
      primaryIndex: { hashKey: "userId", rangeKey: "word" },
    });

    const userPool = new sst.aws.CognitoUserPool("UserPool", {
      usernames: ["email"],
      // Cognito prefix domain for Hosted UI
      domain: { prefix: "ai-wordbook" },
      transform: {
        userPool: {
          // 管理者によるユーザー手動作成のみ許可（セルフサインアップ無効）
          adminCreateUserConfig: { allowAdminCreateUserOnly: true },
          passwordPolicy: {
            minimumLength: 8,
            requireLowercase: true,
            requireNumbers: true,
            requireSymbols: true,
            requireUppercase: true,
            temporaryPasswordValidityDays: 7,
          },
        },
      },
    });

    // MCP 用: パブリッククライアント（シークレット無し / PKCE）
    const mcpClient = userPool.addClient("McpClient", {
      callbackUrls: ["http://127.0.0.1"],
    });

    // Web 用: コンフィデンシャルクライアント（シークレット有 / 認可コードフロー）
    const webClient = userPool.addClient("WebClient", {
      callbackUrls: ["https://ai-wordbook.com/api/auth/callback"],
      transform: {
        client: { generateSecret: true },
      },
    });

    const site = new sst.aws.Nextjs("Site", {
      domain: "ai-wordbook.com",
      environment: {
        COGNITO_USER_POOL_ID: userPool.id,
        COGNITO_MCP_CLIENT_ID: mcpClient.id,
        COGNITO_WEB_CLIENT_ID: webClient.id,
        // Cognito が生成したクライアントシークレットを直接参照
        COGNITO_WEB_CLIENT_SECRET: webClient.secret,
        COGNITO_DOMAIN: userPool.domainUrl!,
        DYNAMODB_TABLE_NAME: wordbook.name,
        APP_BASE_URL: "https://ai-wordbook.com",
      },
      permissions: [
        {
          actions: [
            "dynamodb:PutItem",
            "dynamodb:GetItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:Query",
          ],
          resources: [wordbook.arn],
        },
      ],
    });

    return {
      url: site.url,
    };
  },
});
