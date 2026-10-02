const fs = require('fs');

const payload = {
  title: '52 Things to Know',
  author: 'The Author',
  recipientName: 'Test Recipient',
  chapters: [
    {
      chapter_number: 1,
      title: 'Don\'t Compare Yourself to Others',
      chapter_template: 'classic',
      content: 'This is some content. You would figure that the "competition, comparisons, measuring up, cliques, groups, etc." would be gone once you leave high school and turn 18.',
      photo_urls: [],
      photo_layout: null,
      bible_verse_text: 'A sound heart is life to the body',
      bible_verse_reference: 'PROVERBS 14:30'
    }
  ]
};

async function run() {
  try {
    console.log('Sending request to local backend /generate-pdf...');
    const res = await fetch('http://localhost:3000/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP error ${res.status}: ${errText}`);
    }
    const buffer = await res.arrayBuffer();
    fs.writeFileSync('scratch/test-output.pdf', Buffer.from(buffer));
    console.log('PDF saved to scratch/test-output.pdf successfully!');
  } catch (err) {
    console.error('Local test failed:', err);
  }
}

run();
