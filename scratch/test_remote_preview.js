const payload = {
  title: 'A Book of Wisdom',
  author: 'The Author',
  recipientName: 'Test Recipient',
  chapters: [
    {
      chapter_number: 1,
      title: 'Don\'t Compare Yourself to Others',
      chapter_template: 'horizontal_photo',
      content: 'This is some content.',
      photo_urls: ['https://ukxtkanujwfsyttjklrj.supabase.co/storage/v1/object/public/chapter-photos/test.jpg'],
      photo_layout: JSON.stringify({ focusX: 50, focusY: 50, scale: 1, fit: 'cover' }),
      bible_verse_text: 'A sound heart is life to the body',
      bible_verse_reference: 'PROVERBS 14:30'
    }
  ]
};

async function run() {
  try {
    const res = await fetch('https://pdf-render-service-33np.onrender.com/generate-preview-html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const html = await res.text();
    const match = html.match(/<img[^>]*class="chapter-photo"[^>]*>/i);
    console.log('Resulting img tag:', match ? match[0] : 'Not found');
  } catch (err) {
    console.error(err);
  }
}

run();
