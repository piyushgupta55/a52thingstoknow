import { replaceTokens } from '@/lib/tokenReplacer';
import { parseReviewSpans, applyReviewFlags, type ReviewAction } from '@/lib/reviewTags';
import { useReviewFlags } from '@/hooks/useReviewFlags';
import ReviewCallout from './ReviewCallout';

interface Props {
  content: string;
  recipientName: string;
  recipientGender?: string;
  authorLabel?: string | null;
  previewMode?: boolean;
  noDropCap?: boolean;
  hideLabel?: boolean;
  /** When provided, `<review>` spans render as editor callouts and flags persist. */
  chapterId?: string | null;
  /** True renders the child-facing view: strips <review> wrappers, no callouts. */
  childFacing?: boolean;
}

const splitIntoParagraphs = (text: string): string[] => {
  if (text.includes('\n\n')) return text.split(/\n\n+/).filter(Boolean);
  return [text];
};

/**
 * Render one paragraph, replacing <review>...</review> spans with either
 * inline editor callouts or (in childFacing mode) the inner text.
 * `paraOffsetIndex` is the running <review>-tag counter across the whole body.
 */
function renderParagraphWithReviews(
  para: string,
  startTagIndex: number,
  flags: Record<number, ReviewAction>,
  setFlag: ((i: number, a: ReviewAction) => void) | null,
  childFacing: boolean,
): { nodes: React.ReactNode[]; nextTagIndex: number } {
  const re = /<review>([\s\S]*?)<\/review>/gi;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = startTagIndex;

  const pushPlain = (raw: string, key: string) => {
    const lines = raw.split('\n');
    nodes.push(
      <span key={key}>
        {lines.map((line, i) => (
          <span key={i}>
            {line}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </span>
    );
  };

  while ((m = re.exec(para)) !== null) {
    if (m.index > last) pushPlain(para.slice(last, m.index), `t-${idx}-pre`);
    const action: ReviewAction = flags[idx] ?? 'keep';
    if (childFacing) {
      if (action === 'keep') pushPlain(m[1], `r-${idx}-txt`);
      // soften/remove: drop
    } else if (setFlag) {
      nodes.push(
        <ReviewCallout key={`r-${idx}`} text={m[1]} tagIndex={idx} action={action} onChange={setFlag} />
      );
    } else {
      pushPlain(m[1], `r-${idx}-txt`);
    }
    idx++;
    last = m.index + m[0].length;
  }
  if (last < para.length) pushPlain(para.slice(last), `tail-${idx}`);
  return { nodes, nextTagIndex: idx };
}

const ReferenceBlock = ({
  content, recipientName, recipientGender = '', authorLabel,
  previewMode = false, noDropCap = false, hideLabel = false,
  chapterId = null, childFacing = false,
}: Props) => {
  const processed = replaceTokens(content, {
    recipientName: recipientName || 'your child',
    recipientGender,
    authorLabel,
  });

  const { flags, setFlag } = useReviewFlags(chapterId);
  const paragraphs = splitIntoParagraphs(processed);
  // Precompute running tagIndex per paragraph
  let running = 0;

  return (
    <div className={`${hideLabel ? 'mb-8' : 'my-8'} border-l-[3px] border-primary/25 pl-6 py-2`}>
      <div>
        {paragraphs.map((p, i) => {
          const { nodes, nextTagIndex } = renderParagraphWithReviews(
            p, running, flags, chapterId ? setFlag : null, childFacing
          );
          running = nextTagIndex;
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
              {nodes}
            </p>
          );
        })}
      </div>
    </div>
  );
};

export default ReferenceBlock;
