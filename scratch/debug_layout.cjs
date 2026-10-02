const puppeteer = require('puppeteer');

(async () => {
  const text = "A".repeat(4000); // 4000 characters should be enough to overflow Page 1
  
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const payload = {
    title: 'A Book of Wisdom',
    author: 'Author',
    recipientName: 'Recipient',
    chapters: [{
      title: 'Chapter 1',
      content: text,
      photo_urls: [],
      photo_layout: 'none',
      chapter_template: 'classic',
      memories: []
    }]
  };
  
  const response = await fetch('http://localhost:3000/generate-preview-html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const html = await response.text();
  
  await page.setContent(html);
  
  // Wait for layout final
  await page.waitForFunction(() => document.body.classList.contains('layout-final'));
  
  const measurements = await page.evaluate(() => {
    const pages = document.querySelectorAll('.page');
    return Array.from(pages).map((p, i) => {
      const rect = p.getBoundingClientRect();
      const scale = (rect.height / 828) || 1;
      const backendMaxBottom = rect.top + (800 * scale);
      
      const children = Array.from(p.children).map(c => {
         return {
           className: c.className,
           bottom: c.getBoundingClientRect().bottom,
         };
      });
      
      // also check the units that the backend checks
      const wisdomText = p.querySelector('.wisdom-text');
      const pTags = wisdomText ? Array.from(wisdomText.children).map(c => c.getBoundingClientRect().bottom) : [];
      
      return {
        pageIndex: i,
        pageTop: rect.top + 48,
        backendMaxBottom,
        children,
        pTags
      };
    });
  });
  
  console.log(JSON.stringify(measurements, null, 2));
  await browser.close();
})();
