// 003: RFC 9728 Section 2 に従い resource と authorization_servers を含む JSON を返す
// authorization_servers の値（iss URL）は COGNITO_USER_POOL_ID から組み立てる
export function buildOAuthProtectedResourceMetadata(): Record<string, unknown> {
  const region = process.env.AWS_REGION;
  const poolId = process.env.COGNITO_USER_POOL_ID;
  const baseUrl = process.env.APP_BASE_URL;

  if (!region || !poolId || !baseUrl) {
    throw new Error(
      "AWS_REGION・COGNITO_USER_POOL_ID・APP_BASE_URL のいずれかが未設定です",
    );
  }

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;

  return {
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [issuer],
  };
}
