import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { normalizeWord } from "@/lib/normalize";
import { entriesSchema, prefixSchema, wordInputSchema } from "@/lib/schema";
import { deleteWord } from "./tools/delete";
import { registerWord } from "./tools/register";
import { searchWords } from "./tools/search";
import { updateWord } from "./tools/update";

// バリデーションエラーを「field: message」形式の文字列に変換する
function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "入力値";
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}

function validateWord(raw: string): string {
  const normalized = normalizeWord(raw);
  const result = wordInputSchema.safeParse(normalized);
  if (!result.success) throw new Error(formatZodError(result.error));
  return normalized;
}

function validatePrefix(raw: string): string {
  const normalized = normalizeWord(raw);
  const result = prefixSchema.safeParse(normalized);
  if (!result.success) throw new Error(formatZodError(result.error));
  return normalized;
}

// AWS SDK 例外は固有 name（"ResourceNotFoundException" 等）を持つため name==="Error" で業務エラーを弁別できる。
// DYNAMODB_TABLE_NAME 未設定などの設定エラーも name==="Error" で素通りするが、起動時に顕在化するため許容する。
async function safeCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error && error.name === "Error") throw error;
    throw new Error(
      "処理中にエラーが発生しました。しばらくしてからお試しください。",
    );
  }
}

// RFC 9728: 401 応答でメタデータ URL を広告し、クライアントがディスカバリ経路を発見できるようにする
function buildWwwAuthenticate(): string {
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) return "Bearer";
  return `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`;
}

// 002: パイプライン（正規化 → バリデーション → ツールハンドラ）を組み立てる
export function buildMcpServer(userId: string): McpServer {
  const server = new McpServer({ name: "ai-wordbook", version: "1.0.0" });

  server.registerTool(
    "register_word",
    {
      description: "英単語を辞書情報とともに単語帳に登録する",
      inputSchema: {
        word: z.string().describe("登録する英単語"),
        // MCP SDK が handler より前に entriesSchema で検証する。word とは整形経路が異なるが SDK のエラーで十分なため許容する。
        entries: entriesSchema.describe("品詞・和訳・例文のリスト"),
      },
    },
    async ({ word, entries }) => {
      return safeCall(async () => {
        const normalizedWord = validateWord(word);
        const url = await registerWord(userId, normalizedWord, entries);
        return { content: [{ type: "text", text: url }] };
      });
    },
  );

  server.registerTool(
    "delete_word",
    {
      description: "単語帳から英単語を削除する",
      inputSchema: {
        word: z.string().describe("削除する英単語"),
      },
    },
    async ({ word }) => {
      return safeCall(async () => {
        const normalizedWord = validateWord(word);
        await deleteWord(userId, normalizedWord);
        return {
          content: [
            { type: "text", text: `「${normalizedWord}」を削除しました` },
          ],
        };
      });
    },
  );

  server.registerTool(
    "update_word",
    {
      description: "単語帳の英単語の辞書情報を更新する（登録日時は保持）",
      inputSchema: {
        word: z.string().describe("更新する英単語"),
        entries: entriesSchema.describe("新しい品詞・和訳・例文のリスト"),
      },
    },
    async ({ word, entries }) => {
      return safeCall(async () => {
        const normalizedWord = validateWord(word);
        const url = await updateWord(userId, normalizedWord, entries);
        return { content: [{ type: "text", text: url }] };
      });
    },
  );

  server.registerTool(
    "search_words",
    {
      description: "前方一致で単語帳を検索する（最大 20 件・アルファベット順）",
      inputSchema: {
        prefix: z.string().describe("検索する前方一致文字列"),
      },
    },
    async ({ prefix }) => {
      return safeCall(async () => {
        const normalizedPrefix = validatePrefix(prefix);
        const { items, message } = await searchWords(userId, normalizedPrefix);
        const lines = items.map(
          (item) => `${item.word}: ${item.translation}  ${item.url}`,
        );
        if (message) lines.push(message);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      });
    },
  );

  return server;
}

export async function handleMcpRequest(req: Request): Promise<Response> {
  // 002: JWT 検証 → 401 or sub 取得
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const wwwAuthenticate = buildWwwAuthenticate();

  if (!token) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": wwwAuthenticate },
    });
  }

  const mcpClientId = process.env.COGNITO_MCP_CLIENT_ID;
  if (!mcpClientId) throw new Error("COGNITO_MCP_CLIENT_ID が未設定です");

  let sub: string;
  try {
    ({ sub } = await verifyAccessToken(token, mcpClientId));
  } catch {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": wwwAuthenticate },
    });
  }

  // 003: ステートレス動作（2026-07-28 仕様）— sessionIdGenerator: undefined
  const server = buildMcpServer(sub);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}
