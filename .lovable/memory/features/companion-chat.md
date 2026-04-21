---
name: Companion Chat (52)
description: AI companion (52) with floating bubble in editor, page-anchored badge in preview, voice I/O, streaming responses, dynamic context injection
type: feature
---
# Companion Chat — 52

## Identity
- "52" numeral in dusty rose (#C4788A) on white circle — larger primary-action button (56px floating, badge on preview pages)
- Merriweather serif font for the numeral
- Pulse animation on first visit to each chapter, no auto-open

## Placement & Variants
- **Floating** (`variant="floating"`): Fixed bottom-right in ChapterEditor, visible in both Edit and Preview modes
- **Badge** (`variant="badge"`): Anchored to top-right corner of the chapter page spread in PreviewBook, looks like a tab on the page edge
- Clicking in Preview → navigates to chapter editor (or switches to Edit mode) AND opens chat
- Clicking in Edit → just opens chat

## Voice
- **Input**: Web Speech API (`webkitSpeechRecognition`), mic button in chat input, sends transcript as message
- **Output**: Browser `speechSynthesis` reads assistant responses when complete. Speaker/mute toggle in header. Will upgrade to ElevenLabs later.

## Technical
- Edge function: `companion-chat` with static identity prompt + dynamically injected context (book, chapter, word count, template, progress)
- Hook: `useCompanionChat` handles SSE streaming, auth token
- Messages reset per chapter; conversation history sent with each request
- ReactMarkdown for assistant message rendering
