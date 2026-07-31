import { buildOAuthProtectedResourceMetadata } from "@/features/mcp/discovery";

export async function GET(): Promise<Response> {
  const metadata = buildOAuthProtectedResourceMetadata();
  return Response.json(metadata);
}
