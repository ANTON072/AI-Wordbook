import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createRemoteJWKSet, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestTable, deleteAllItems, fetchItem } from "@/test/dynamo";
import { buildMcpServer, handleMcpRequest } from "./server";

// createRemoteJWKSet だけをモックし、署名検証は jose 本来の実装を使う
vi.mock("jose", async (importOriginal) => {
  const original = await importOriginal<typeof import("jose")>();
  return { ...original, createRemoteJWKSet: vi.fn() };
});

const TEST_REGION = "ap-northeast-1";
const TEST_POOL_ID = "ap-northeast-1_TestPool";
const TEST_MCP_CLIENT_ID = "test-mcp-client-id";
const TEST_ISS = `https://cognito-idp.${TEST_REGION}.amazonaws.com/${TEST_POOL_ID}`;
const TEST_USER_SUB = "server-test-user-sub";

let privateKey: CryptoKey;
let differentPrivateKey: CryptoKey;

beforeAll(async () => {
  process.env.AWS_REGION = TEST_REGION;
  process.env.COGNITO_USER_POOL_ID = TEST_POOL_ID;
  process.env.COGNITO_MCP_CLIENT_ID = TEST_MCP_CLIENT_ID;
  process.env.APP_BASE_URL = "https://example.com";

  const keyPair = await generateKeyPair("RS256");
  privateKey = keyPair.privateKey;

  const otherPair = await generateKeyPair("RS256");
  differentPrivateKey = otherPair.privateKey;

  vi.mocked(createRemoteJWKSet).mockReturnValue(
    // biome-ignore lint/suspicious/noExplicitAny: モックの型合わせ
    vi.fn().mockResolvedValue(keyPair.publicKey) as any,
  );

  await createTestTable();
});

afterEach(async () => {
  await deleteAllItems();
});

async function makeInvalidRequest(token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  return handleMcpRequest(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
    }),
  );
}

async function signToken({
  exp,
  key,
  sub = TEST_USER_SUB,
}: {
  exp?: number;
  key?: CryptoKey;
  sub?: string;
} = {}): Promise<string> {
  const builder = new SignJWT({
    client_id: TEST_MCP_CLIENT_ID,
    token_use: "access",
    sub,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(TEST_ISS);

  builder.setExpirationTime(exp ?? "1h");
  return builder.sign(key ?? privateKey);
}

// buildMcpServer + transport を使ってツールを直接呼び出すヘルパー
async function callTool(
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  const server = buildMcpServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  const response = await transport.handleRequest(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
    }),
  );

  const json = (await response.json()) as {
    result: {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
  };
  return json.result;
}

const VALID_ENTRIES = [
  {
    partOfSpeech: "adjective" as const,
    translation: "信頼できる",
    examples: [{ en: "She is reliable.", ja: "彼女は信頼できる。" }],
  },
];

describe("handleMcpRequest — JWT 検証", () => {
  it("Authorization ヘッダーがない場合に 401 を返す", async () => {
    // Act
    const res = await makeInvalidRequest(null);
    // Assert
    expect(res.status).toBe(401);
  });

  it("401 応答に WWW-Authenticate ヘッダが含まれる", async () => {
    // Act
    const res = await makeInvalidRequest(null);
    // Assert
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect(res.headers.get("WWW-Authenticate")).toContain(
      ".well-known/oauth-protected-resource",
    );
  });

  it("期限切れのアクセストークンで 401 を返す", async () => {
    // Arrange
    const expiredAt = Math.floor(Date.now() / 1000) - 3600;
    const token = await signToken({ exp: expiredAt });
    // Act
    const res = await makeInvalidRequest(token);
    // Assert
    expect(res.status).toBe(401);
  });

  it("署名不正（別の秘密鍵）のアクセストークンで 401 を返す", async () => {
    // Arrange
    const token = await signToken({ key: differentPrivateKey });
    // Act
    const res = await makeInvalidRequest(token);
    // Assert
    expect(res.status).toBe(401);
  });
});

describe("buildMcpServer — パイプライン結合", () => {
  it("大文字の word が正規化されて DynamoDB に保存される", async () => {
    // Arrange: "Reliable"（大文字）を入力
    // Act
    const result = await callTool(TEST_USER_SUB, "register_word", {
      word: "Reliable",
      entries: VALID_ENTRIES,
    });

    // Assert: MCP ツールの結果は URL
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("/wordbook/reliable");

    // Assert: DynamoDB には正規化後の "reliable" が保存されている
    const item = await fetchItem(TEST_USER_SUB, "reliable");
    expect(item).toBeDefined();
  });

  it("無効な word でバリデーションエラーが返る（isError: true）", async () => {
    // Act: 数字始まりの無効な word
    const result = await callTool(TEST_USER_SUB, "register_word", {
      word: "123invalid",
      entries: VALID_ENTRIES,
    });

    // Assert
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBeTruthy();
  });

  it("sub が userId として DynamoDB に保存される（ユーザー分離の結線）", async () => {
    // Act
    await callTool(TEST_USER_SUB, "register_word", {
      word: "reliable",
      entries: VALID_ENTRIES,
    });

    // Assert: PK（userId）が JWT の sub と一致する
    const item = await fetchItem(TEST_USER_SUB, "reliable");
    expect(item?.userId).toBe(TEST_USER_SUB);
  });

  it("DynamoDB 障害時に汎用メッセージが返り内部情報が漏れない", async () => {
    // Arrange: 存在しないテーブルを参照させて ResourceNotFoundException を発生させる
    const originalTable = process.env.DYNAMODB_TABLE_NAME;
    process.env.DYNAMODB_TABLE_NAME = "non-existent-table-for-testing";

    try {
      // Act
      const result = await callTool(TEST_USER_SUB, "register_word", {
        word: "reliable",
        entries: VALID_ENTRIES,
      });

      // Assert: 汎用メッセージが返り、テーブル名等の内部情報が含まれない
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(
        "処理中にエラーが発生しました。しばらくしてからお試しください。",
      );
      expect(result.content[0].text).not.toContain("non-existent-table");
    } finally {
      process.env.DYNAMODB_TABLE_NAME = originalTable;
    }
  });

  it("search_words のテキスト整形（word: translation  url 形式）が正しく返る", async () => {
    // Arrange: 2 件登録
    await callTool(TEST_USER_SUB, "register_word", {
      word: "reliable",
      entries: VALID_ENTRIES,
    });
    await callTool(TEST_USER_SUB, "register_word", {
      word: "relevant",
      entries: [{ ...VALID_ENTRIES[0], translation: "関連する" }],
    });

    // Act
    const result = await callTool(TEST_USER_SUB, "search_words", {
      prefix: "rel",
    });

    // Assert: "word: translation  url" 形式で 2 行（DynamoDB SK 順: relevant < reliable）
    expect(result.isError).toBeFalsy();
    const lines = result.content[0].text.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "relevant: 関連する  https://example.com/wordbook/relevant",
    );
    expect(lines[1]).toBe(
      "reliable: 信頼できる  https://example.com/wordbook/reliable",
    );
  });
});
