import { describe, expect, it } from "vitest";
import { normalizeWord } from "./normalize";

describe("normalizeWord", () => {
  it("大文字を小文字に変換する", () => {
    // Arrange
    const input = "Reliable";
    // Act
    const result = normalizeWord(input);
    // Assert
    expect(result).toBe("reliable");
  });

  it("全角英字を半角に変換する", () => {
    // Arrange
    const input = "ｒｅｌｉａｂｌｅ";
    // Act
    const result = normalizeWord(input);
    // Assert
    expect(result).toBe("reliable");
  });

  it("前後の空白を除去する", () => {
    // Arrange
    const input = "  reliable  ";
    // Act
    const result = normalizeWord(input);
    // Assert
    expect(result).toBe("reliable");
  });

  it("連続スペースを1つに統一する", () => {
    // Arrange
    const input = "pick  up";
    // Act
    const result = normalizeWord(input);
    // Assert
    expect(result).toBe("pick up");
  });

  it("全角・大文字・前後空白・連続スペースが混在する複合ケースを正規化する", () => {
    // Arrange
    const input = " Ｐｉｃｋ  Ｕｐ ";
    // Act
    const result = normalizeWord(input);
    // Assert
    expect(result).toBe("pick up");
  });
});
