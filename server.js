const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/api/scrape', async (req, res) => {
  const { url, waitfor } = req.query;

  if (!url || !waitfor) {
    return res.status(400).json({ error: 'Missing url or waitfor parameter' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    let foundResponse = null;

    // Listen for responses
    page.on('response', async (response) => {
      const responseUrl = response.url();
      if (responseUrl.includes(`.${waitfor}`) || responseUrl.endsWith(`.${waitfor}`)) {
        try {
          const contentType = response.headers()['content-type'] || '';
          let body;
          if (contentType.includes('json')) {
            body = await response.json();
          } else {
            body = await response.text();
          }
          foundResponse = {
            url: responseUrl,
            status: response.status(),
            headers: response.headers(),
            body: body
          };
        } catch (e) {
          // Ignore errors in parsing response
        }
      }
    });

    // Navigate to the URL
    await page.goto(url, { waitUntil: 'networkidle0' });

    // Wait for the response to be found, with a timeout
    let attempts = 0;
    const maxAttempts = 50; // About 5 seconds at 100ms intervals
    while (!foundResponse && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!foundResponse) {
      return res.status(404).json({ error: `No ${waitfor} file found in network requests` });
    }

    res.json(foundResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});