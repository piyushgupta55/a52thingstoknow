export interface BookData {
  title: string;
  author?: string;
  chapters: Array<{
    title: string;
    content: string; // HTML or Markdown depending on layout
    photo_urls?: string[];
    memories?: Array<{
      contributor_name: string;
      memory_text: string;
    }>;
    chapter_number?: number;
    chapter_template?: string;
    bible_verse_text?: string | null;
    bible_verse_reference?: string | null;
    quote_text?: string | null;
    quote_attribution?: string | null;
  }>;
  ancestryText?: string | null;
  ancestryPdfUrl?: string | null;
}
