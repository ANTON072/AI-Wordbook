import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // 結合テストは同じDBを共有するのでファイル間を直列に走らせる
    // 並列実行するとテスト中にほかのテストからDBが書き換えられてしまう
    fileParallelism: false,
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
