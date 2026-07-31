import { handleMcpRequest } from "@/features/mcp/server";

export async function POST(req: Request): Promise<Response> {
  return handleMcpRequest(req);
}

// Claude Desktop が SSE で GET することがある（MCP Streamable HTTP の仕様）
export async function GET(req: Request): Promise<Response> {
  return handleMcpRequest(req);
}
