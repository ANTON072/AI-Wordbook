import { createRemoteJWKSet, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { verifyAccessToken } from "./auth";

// createRemoteJWKSet だけをモックし、署名検証は jose 本来の実装を使う
vi.mock("jose", async (importOriginal) => {
  const original = await importOriginal<typeof import("jose")>();
  return {
    ...original,
    createRemoteJWKSet: vi.fn(),
  };
});

const TEST_REGION = "ap-northeast-1";
const TEST_POOL_ID = "ap-northeast-1_TestPool";
const TEST_CLIENT_ID = "test-mcp-client-id";
const TEST_ISS = `https://cognito-idp.${TEST_REGION}.amazonaws.com/${TEST_POOL_ID}`;

let privateKey: CryptoKey;
let differentPrivateKey: CryptoKey;

beforeAll(async () => {
  process.env.AWS_REGION = TEST_REGION;
  process.env.COGNITO_USER_POOL_ID = TEST_POOL_ID;

  const keyPair = await generateKeyPair("RS256");
  privateKey = keyPair.privateKey;
  const { publicKey } = keyPair;

  const otherKeyPair = await generateKeyPair("RS256");
  differentPrivateKey = otherKeyPair.privateKey;

  // JWKS フェッチをスキップし、テスト用公開鍵をそのまま返すリゾルバを注入する
  vi.mocked(createRemoteJWKSet).mockReturnValue(
    // biome-ignore lint/suspicious/noExplicitAny: モックの型合わせに any が必要
    vi.fn().mockResolvedValue(publicKey) as any,
  );
});

afterAll(() => {
  delete process.env.AWS_REGION;
  delete process.env.COGNITO_USER_POOL_ID;
});

async function signToken({
  payload = {},
  exp,
  issuer = TEST_ISS,
  key,
}: {
  payload?: Record<string, unknown>;
  exp?: number;
  issuer?: string;
  key?: CryptoKey;
} = {}): Promise<string> {
  const builder = new SignJWT({
    client_id: TEST_CLIENT_ID,
    token_use: "access",
    sub: "user-sub-123",
    ...payload,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(issuer);

  if (exp !== undefined) {
    builder.setExpirationTime(exp);
  } else {
    builder.setExpirationTime("1h");
  }

  return builder.sign(key ?? privateKey);
}

describe("verifyAccessToken", () => {
  it("正常な JWT で sub が返る", async () => {
    // Arrange
    const token = await signToken();
    // Act
    const result = await verifyAccessToken(token, TEST_CLIENT_ID);
    // Assert
    expect(result.sub).toBe("user-sub-123");
  });

  it("期限切れ JWT で例外が投げられる", async () => {
    // Arrange
    const expiredAt = Math.floor(Date.now() / 1000) - 3600;
    const token = await signToken({ exp: expiredAt });
    // Act & Assert
    await expect(verifyAccessToken(token, TEST_CLIENT_ID)).rejects.toThrow();
  });

  it("署名不正（別の秘密鍵）で例外が投げられる", async () => {
    // Arrange
    const token = await signToken({ key: differentPrivateKey });
    // Act & Assert
    await expect(verifyAccessToken(token, TEST_CLIENT_ID)).rejects.toThrow();
  });

  it("expectedClientId 不一致で例外が投げられる", async () => {
    // Arrange
    const token = await signToken();
    // Act & Assert
    await expect(verifyAccessToken(token, "wrong-client-id")).rejects.toThrow(
      "client_id が一致しません",
    );
  });

  it("token_use が access でない場合に例外が投げられる", async () => {
    // Arrange
    const token = await signToken({ payload: { token_use: "id" } });
    // Act & Assert
    await expect(verifyAccessToken(token, TEST_CLIENT_ID)).rejects.toThrow(
      "token_use が access ではありません",
    );
  });

  it("iss 不一致（別 User Pool）で例外が投げられる", async () => {
    // Arrange
    const token = await signToken({
      issuer:
        "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_Evil",
    });
    // Act & Assert
    await expect(verifyAccessToken(token, TEST_CLIENT_ID)).rejects.toThrow();
  });

  it("sub クレームが欠落している場合に例外が投げられる", async () => {
    // Arrange
    const token = await signToken({ payload: { sub: undefined } });
    // Act & Assert
    await expect(verifyAccessToken(token, TEST_CLIENT_ID)).rejects.toThrow(
      "sub クレームが文字列ではありません",
    );
  });

  it("MCP 経路と Web 経路で expectedClientId を切り替えて検証できる", async () => {
    // Arrange
    const webClientId = "test-web-client-id";
    const mcpToken = await signToken();
    const webToken = await signToken({ payload: { client_id: webClientId } });

    // Act
    const mcpResult = await verifyAccessToken(mcpToken, TEST_CLIENT_ID);
    const webResult = await verifyAccessToken(webToken, webClientId);

    // Assert
    expect(mcpResult.sub).toBe("user-sub-123");
    expect(webResult.sub).toBe("user-sub-123");
  });
});
