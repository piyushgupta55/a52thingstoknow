const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
    console.log(error.stack);
  });
  await page.goto('http://localhost:4173/book/16540701-7a62-413b-ba45-70981f272064/chapter/25b8aa49-9986-4bb0-bfe6-a0bd56cab2b7', {waitUntil: 'networkidle0'}).catch(e => console.log(e));
  
  // Try to find a button to mark complete or add memory to trigger interaction
  try {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      await btn.click().catch(() => {});
    }
  } catch(e) {}
  
  // Wait a bit to catch async errors
  await new Promise(resolve => setTimeout(resolve, 2000));
  await browser.close();
})();
