const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

exports.handler = async (event, context) => {
  const { url, waitfor } = event.queryStringParameters || {};

  if (!url || !waitfor) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing url or waitfor parameter' }),
    };
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
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
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for the response to be found, with a timeout
    let attempts = 0;
    const maxAttempts = 100; // About 10 seconds at 100ms intervals
    while (!foundResponse && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!foundResponse) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `No ${waitfor} file found in network requests` }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(foundResponse),
    };
  } catch (error) {
    console.error('Error details:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};