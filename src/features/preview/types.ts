import type React from 'react';

export interface Memory {
  id: string;
  chapter_id: string;
  contributor_name: string;
  memory_text: string;
}

export interface Book {
  id: string;
  recipient_name: string;
  recipient_gender: string;
  relationship: string;
  occasion: string;
  user_id: string;
  from_label: string | null;
  author_label: string | null;
  gender: string;
}

export interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  status: string;
  content: string | null;
  reference_text: string | null;
  bible_verse_text: string | null;
  bible_verse_reference: string | null;
  quote_text: string | null;
  quote_attribution: string | null;
  photo_urls: string[];
  photo_layout?: string | null;
  chapter_template: string;
  is_photo_chapter: boolean;
  review_status?: string | null;
  review_note?: string | null;
  read_at?: string | null;
}

export interface ChapterTemplate {
  chapter_number: number;
  title: string;
  is_photo_chapter: boolean;
  reference_content: string | null;
}


export type SpreadDef =
  | { type: 'title' }
  | { type: 'toc' }
  | { type: 'letter' }
  | { type: 'chapter'; chapter: Chapter }
  | { type: 'ancestry' }
  | { type: 'family_history' };

export type SpreadRender = [React.ReactNode, React.ReactNode, string | undefined, boolean, React.ReactNode | null];
