import { countWords } from '@/lib/page2Status';

export const mergeRefAndContent = (referenceText: string, content: string) => {
  const needsSpace =
    referenceText.length > 0 &&
    content.length > 0 &&
    !/\s$/.test(referenceText) &&
    !/^\s/.test(content);
  return referenceText + (needsSpace ? ' ' : '') + content;
};

export const splitRefByWordLimit = (text: string, wordLimit: number) => {
  if (!text) return { page1: '', page2: '' };
  const tokens = text.split(/(\s+)/);
  let words = 0;
  let splitAt = tokens.length;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok && !/^\s+$/.test(tok)) {
      const inner = countWords(tok);
      if (words + inner > wordLimit) {
        splitAt = i;
        break;
      }
      words += inner;
    }
  }
  return {
    page1: tokens.slice(0, splitAt).join(''),
    page2: tokens.slice(splitAt).join('').replace(/^\s+/, ''),
  };
};

export const splitAtSentenceBoundary = (text: string, wordLimit: number) => {
  if (!text) return { page1: '', page2: '' };
  const wordSplit = splitRefByWordLimit(text, wordLimit);
  if (!wordSplit.page2) return wordSplit;

  const pageOneEnd = wordSplit.page1.length;
  const sentenceEndRe = /[.!?]["')\]]?(?=\s|$)/g;
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = sentenceEndRe.exec(text)) !== null) {
    const endPos = m.index + m[0].length;
    if (endPos > pageOneEnd) break;
    lastEnd = endPos;
  }
  if (lastEnd < 0) return wordSplit;

  const ws = /^\s+/.exec(text.slice(lastEnd));
  const seam = lastEnd + (ws ? ws[0].length : 0);
  return {
    page1: text.slice(0, seam),
    page2: text.slice(seam),
  };
};

export const splitForCurrentLayout = (
  text: string,
  wordLimit: number,
  usesPhotoCapacity: boolean,
) => {
  if (usesPhotoCapacity) {
    return splitRefByWordLimit(text, wordLimit);
  }
  return splitRefByWordLimit(text, wordLimit);
};
