// 002: https://<ドメイン>/wordbook/<URLエンコード済み正規化済み単語>
export function buildWordPageUrl(word: string): string {
  const base = process.env.APP_BASE_URL;
  if (!base) {
    throw new Error("APP_BASE_URL が未設定です");
  }
  return `${base}/wordbook/${encodeURIComponent(word)}`;
}
