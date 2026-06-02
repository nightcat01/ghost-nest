const expressionLabels: Record<string, string> = {
  neutral: "기본 표정",
  happy: "기쁜 표정",
  thinking: "생각하는 표정",
  surprised: "놀란 표정",
};

/**
 * Shows a user-facing expression name while preserving the stored key.
 */
export function createExpressionLabel(expression: string) {
  return expressionLabels[expression]
    ? `${expressionLabels[expression]} (${expression})`
    : `${expression} 표정`;
}
