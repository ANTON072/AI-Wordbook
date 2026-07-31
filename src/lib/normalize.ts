export function normalizeWord(input: string): string {
  return input
    .normalize("NFKC") // 全角英数字→半角（Unicode 正規化 NFKC）
    .toLowerCase()
    .trim()
    .replace(/ +/g, " "); // 連続スペースを1つに統一
}
