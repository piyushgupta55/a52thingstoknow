export interface CompanionSuggestion {
  from: string;
  to: string;
}

const normalizeForMatch = (value: string) =>
  value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

const suggestionPatterns = [
  /Change\s+["“](.+?)["”]\s+to\s+["“](.+?)["”]/gi,
  /Change\s+'(.+?)'\s+to\s+'(.+?)'/gi,
  /Replace\s+["“](.+?)["”]\s+with\s+["“](.+?)["”]/gi,
  /Replace\s+'(.+?)'\s+with\s+'(.+?)'/gi,
  /Swap\s+["“](.+?)["”]\s+for\s+["“](.+?)["”]/gi,
  /Swap\s+'(.+?)'\s+for\s+'(.+?)'/gi,
] as const;

export const extractQuotedSuggestions = (text: string): CompanionSuggestion[] => {
  const suggestions: CompanionSuggestion[] = [];
  const seen = new Set<string>();

  for (const pattern of suggestionPatterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const from = match[1]?.trim();
      const to = match[2]?.trim();
      if (!from || !to) continue;

      const key = `${from}→${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      suggestions.push({ from, to });
    }
  }

  return suggestions;
};

export const isApprovalMessage = (input: string) => {
  const normalized = input.trim().toLowerCase().replace(/[.!?]+$/g, '');

  return [
    'yes',
    'yes please',
    'yep',
    'yeah',
    'ok',
    'okay',
    'sure',
    'sounds good',
    'go ahead',
    'do it',
    'apply it',
    'apply that',
    'apply this',
    'make that change',
    'make this change',
    'use that',
    'use this',
  ].includes(normalized);
};

export const applySuggestionToText = (text: string, suggestion: CompanionSuggestion) => {
  if (!text.trim()) return null;

  const exactIndex = text.indexOf(suggestion.from);
  if (exactIndex !== -1) {
    return text.slice(0, exactIndex) + suggestion.to + text.slice(exactIndex + suggestion.from.length);
  }

  const normalizedText = normalizeForMatch(text);
  const normalizedTarget = normalizeForMatch(suggestion.from);
  const looseIndex = normalizedText.indexOf(normalizedTarget);

  if (looseIndex === -1) return null;

  return text.slice(0, looseIndex) + suggestion.to + text.slice(looseIndex + suggestion.from.length);
};