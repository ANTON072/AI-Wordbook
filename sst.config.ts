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
    const domain = "ai-wordbook.com";

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
      // Claude カスタムコネクタの OAuth コールバック（claude.ai / claude.com の両ドメイン）
      callbackUrls: [
        "https://claude.ai/api/mcp/auth_callback",
        "https://claude.com/api/mcp/auth_callback",
      ],
      transform: {
        client: {
          allowedOauthFlows: ["code"],
          allowedOauthFlowsUserPoolClient: true,
          // 003:137 - scopes は openid のみ（最小）。MCP クライアントには
          // discovery の scopes_supported で openid のみ要求するよう伝えている
          allowedOauthScopes: ["openid"],
          supportedIdentityProviders: ["COGNITO"],
        },
      },
    });

    // Web 用: コンフィデンシャルクライアント（シークレット有 / 認可コードフロー）
    const webClient = userPool.addClient("WebClient", {
      callbackUrls: [`https://${domain}/api/auth/callback`],
      transform: {
        client: {
          generateSecret: true,
          allowedOauthFlows: ["code"],
          allowedOauthFlowsUserPoolClient: true,
          // 003:137 - scopes は openid のみ（最小）
          allowedOauthScopes: ["openid"],
          supportedIdentityProviders: ["COGNITO"],
        },
      },
    });

    const site = new sst.aws.Nextjs("Site", {
      domain: domain,
      environment: {
        COGNITO_USER_POOL_ID: userPool.id,
        COGNITO_MCP_CLIENT_ID: mcpClient.id,
        COGNITO_WEB_CLIENT_ID: webClient.id,
        // Cognito が生成したクライアントシークレットを直接参照
        COGNITO_WEB_CLIENT_SECRET: webClient.secret,
        // biome-ignore lint/style/noNonNullAssertion: かならず値が存在する
        COGNITO_DOMAIN: userPool.domainUrl!,
        DYNAMODB_TABLE_NAME: wordbook.name,
        APP_BASE_URL: `https://${domain}`,
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
