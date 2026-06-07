export function shouldTrigger(
  message: string,
  keywords: string[],
  matchType: "exact" | "contains"
): boolean {
  if (!message || keywords.length === 0) return false;

  const normalizedMessage = message.trim().toLowerCase();

  return keywords.some((kw) => {
    const normalizedKeyword = kw.trim().toLowerCase();

    if (matchType === "exact") {
      return normalizedMessage === normalizedKeyword;
    } else {
      return normalizedMessage.includes(normalizedKeyword);
    }
  });
}