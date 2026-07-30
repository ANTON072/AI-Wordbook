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
      transform: {
        userPool: {
          // Cognito のセルフサインアップを無効化（管理者による手動作成のみ）
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

    const userPoolDomain = new aws.cognito.UserPoolDomain("UserPoolDomain", {
      domain: "ai-wordbook",
      userPoolId: userPool.id,
    });

    // MCP 用: パブリッククライアント（シークレット無し）/ PKCE
    const mcpClient = userPool.addClient("McpClient", {
      scopes: ["openid"],
      callbackUrls: ["http://127.0.0.1"],
      grantTypes: ["authorization_code"],
      supportedIdentityProviders: ["COGNITO"],
    });

    // Web 用: コンフィデンシャルクライアント（シークレット有）/ 認可コードフロー
    const webClient = userPool.addClient("WebClient", {
      scopes: ["openid"],
      callbackUrls: ["https://ai-wordbook.com/api/auth/callback"],
      grantTypes: ["authorization_code"],
      supportedIdentityProviders: ["COGNITO"],
      transform: {
        client: { generateSecret: true },
      },
    });

    // Cognito が生成した Web クライアントシークレットを SST Secret で管理
    // デプロイ後に `sst secret set CognitoWebClientSecret <value>` で値を設定する
    const webClientSecret = new sst.Secret("CognitoWebClientSecret");

    const site = new sst.aws.Nextjs("Site", {
      domain: "ai-wordbook.com",
      environment: {
        COGNITO_USER_POOL_ID: userPool.id,
        COGNITO_MCP_CLIENT_ID: mcpClient.id,
        COGNITO_WEB_CLIENT_ID: webClient.id,
        COGNITO_WEB_CLIENT_SECRET: webClientSecret.value,
        COGNITO_DOMAIN: $interpolate`https://${userPoolDomain.domain}.auth.ap-northeast-1.amazoncognito.com`,
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
