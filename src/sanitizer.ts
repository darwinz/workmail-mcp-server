export type Sanitizer = (text: string) => string;

export function createSanitizer(secrets: string[]): Sanitizer {
  // Filter out empty strings and very short values that would cause false positives
  const patterns = secrets.filter((s) => s.length >= 4);

  return (text: string): string => {
    let result = text;
    for (const secret of patterns) {
      // Replace all occurrences, case-sensitive
      while (result.includes(secret)) {
        result = result.replace(secret, "[REDACTED]");
      }
    }
    // Also strip any Authorization headers that might appear in error dumps
    result = result.replace(/Authorization:\s*\S+/gi, "Authorization: [REDACTED]");
    return result;
  };
}
