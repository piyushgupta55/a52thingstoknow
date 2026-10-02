const rawText = "The type of people you date are ultimately a reflection on you. If you date someone who is selfish, self-absorbed, and totally focused on themselves, it reflects that you don’t think much of yourself. Don’t choose people who don’t appreciate you. Does that make sense?";

const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const wordSegmenter = new Intl.Segmenter('en', { granularity: 'word' });

const graphemes = Array.from(graphemeSegmenter.segment(rawText));
const words = Array.from(wordSegmenter.segment(rawText));

const wordBoundarySet = new Set();
words.forEach(w => {
  wordBoundarySet.add(w.index);
  wordBoundarySet.add(w.index + w.segment.length);
});

const safeSplitOffsets = [0];
graphemes.forEach(g => {
  const nextOffset = g.index + g.segment.length;
  if (wordBoundarySet.has(nextOffset)) {
    safeSplitOffsets.push(nextOffset);
  }
});

console.log("safeSplitOffsets:", safeSplitOffsets);
const indexofS = rawText.indexOf("someone");
console.log("Index of 'someone':", indexofS);
console.log("Offsets in 'someone':", safeSplitOffsets.filter(o => o >= indexofS && o <= indexofS + 7));
