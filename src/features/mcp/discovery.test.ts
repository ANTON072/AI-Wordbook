import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildOAuthProtectedResourceMetadata } from "./discovery";

describe("buildOAuthProtectedResourceMetadata", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.APP_BASE_URL = "https://example.com";
    process.env.AWS_REGION = "ap-northeast-1";
    process.env.COGNITO_USER_POOL_ID = "ap-northeast-1_TestPool";
  });

  afterEach(() => {
    process.env.APP_BASE_URL = originalEnv.APP_BASE_URL;
    process.env.AWS_REGION = originalEnv.AWS_REGION;
    process.env.COGNITO_USER_POOL_ID = originalEnv.COGNITO_USER_POOL_ID;
  });

  it("resource を APP_BASE_URL + /api/mcp で組み立てる", () => {
    // Act
    const metadata = buildOAuthProtectedResourceMetadata();
    // Assert
    expect(metadata.resource).toBe("https://example.com/api/mcp");
  });

  it("authorization_servers を Cognito iss URL で組み立てる", () => {
    // Act
    const metadata = buildOAuthProtectedResourceMetadata();
    // Assert
    expect(metadata.authorization_servers).toEqual([
      "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_TestPool",
    ]);
  });
});
