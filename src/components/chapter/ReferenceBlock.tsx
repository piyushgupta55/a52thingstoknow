import { replaceTokens } from '@/lib/tokenReplacer';

interface Props {
  content: string;
  recipientName: string;
  recipientGender?: string;
  authorLabel?: string | null;
  previewMode?: boolean;
  noDropCap?: boolean;
  hideLabel?: boolean;
}

const splitIntoParagraphs = (text: string): string[] => {
  // If the text has explicit double-newline paragraph breaks, use them
  if (text.includes('\n\n')) {
    return text.split(/\n\n+/).filter(Boolean);
  }
  // Otherwise render as a single paragraph — do not auto-split
  return [text];
};

const ReferenceBlock = ({ content, recipientName, recipientGender = '', authorLabel, previewMode = false, noDropCap = false, hideLabel = false }: Props) => {
  const processed = replaceTokens(content, {
    recipientName: recipientName || 'your child',
    recipientGender,
    authorLabel,
  });
  const paragraphs = splitIntoParagraphs(processed);

  return (
    <div className={`${hideLabel ? 'mb-8' : 'my-8'} border-l-[3px] border-primary/25 pl-6 py-2`}>
      <div>
        {paragraphs.map((p, i) => {
          const lines = p.split('\n');
          return (
            <p
              key={i}
              className={`text-[14px] italic leading-[1.75] text-foreground/55 ${
                i === 0 && !noDropCap ? 'drop-cap' : ''
              }`}
              style={{
                fontFamily: 'var(--font-devotional)',
                marginBottom: i < paragraphs.length - 1 ? '1.4em' : 0,
              }}
            >
              {lines.map((line, idx) => (
                <span key={idx}>
                  {line}
                  {idx < lines.length - 1 && <br />}
                </span>
              ))}
            </p>
          );
        })}
      </div>
    </div>
  );
};

export default ReferenceBlock;
