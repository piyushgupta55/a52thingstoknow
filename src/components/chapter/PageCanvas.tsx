import { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  previewMode?: boolean;
  pageNumber?: number;
  wordCount?: number;
  wordLimit?: number;
  showWordCount?: boolean;
  companionSlot?: ReactNode;
}

const PageCanvas = ({ children, previewMode = false, pageNumber, wordCount, wordLimit, showWordCount = false, companionSlot }: Props) => {
  const percent = wordLimit && wordCount != null ? (wordCount / wordLimit) * 100 : 0;

  let countColor = '#9CA3AF';
  let message = '';
  if (percent >= 100) {
    countColor = '#EF4444';
    message = 'This page is full — your words look beautiful';
  } else if (percent >= 90) {
    countColor = '#EF4444';
    message = 'Page almost full — a great place to close your thought';
  } else if (percent >= 75) {
    countColor = '#D97706';
  }

  return (
    <div
      className="relative mx-auto"
      style={{
        width: '600px',
        maxWidth: '100%',
        background: '#FFFFFF',
        borderRadius: '4px',
        boxShadow: previewMode
          ? '0 4px 20px rgba(0,0,0,0.12)'
          : '0 2px 12px rgba(0,0,0,0.08)',
        padding: '54px 60px',
      }}
    >
      {companionSlot && (
        <div className="absolute -top-5 -right-5 z-20">
          {companionSlot}
        </div>
      )}

      {children}

      {showWordCount && wordCount != null && wordLimit && (
        <div className="absolute bottom-3 right-5 text-right">
          <p
            className="text-[0.6rem] tracking-wide"
            style={{ fontFamily: 'var(--font-body)', color: countColor }}
          >
            Page {pageNumber} · {wordCount} / {wordLimit} words
          </p>
          {message && (
            <p
              className="text-[0.55rem] mt-0.5 italic"
              style={{ fontFamily: 'var(--font-body)', color: countColor }}
            >
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PageCanvas;
