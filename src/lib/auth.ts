import { createRemoteJWKSet, jwtVerify } from "jose";

// 003: iss は COGNITO_USER_POOL_ID から導出。issuer URL を独立変数として持たせない
function buildIssuer(): string {
  const region = process.env.AWS_REGION;
  const poolId = process.env.COGNITO_USER_POOL_ID;
  if (!region || !poolId) {
    throw new Error("AWS_REGION または COGNITO_USER_POOL_ID が未設定です");
  }
  return `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
}

// 003: createRemoteJWKSet で JWKS をキャッシュし、ウォーム時のレイテンシを削減
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return jwksCache;
}

// 002: 検証項目 — exp / iss / client_id / token_use === "access" / Cognito 公開鍵署名
// expectedClientId で MCP 経路（COGNITO_MCP_CLIENT_ID）と Web 経路（COGNITO_WEB_CLIENT_ID）を切替
export async function verifyAccessToken(
  token: string,
  expectedClientId: string,
): Promise<{ sub: string }> {
  const issuer = buildIssuer();
  const jwks = getJwks(issuer);

  const { payload } = await jwtVerify(token, jwks, {
    issuer,
    // 003: Cognito のアクセストークンは aud を持たない。audience 検証は行わない
  });

  if (payload.client_id !== expectedClientId) {
    throw new Error("client_id が一致しません");
  }

  if (payload.token_use !== "access") {
    throw new Error("token_use が access ではありません");
  }

  if (typeof payload.sub !== "string") {
    throw new Error("sub クレームが文字列ではありません");
  }

  return { sub: payload.sub };
}
