exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const query = params.query || '';

  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query' }) };
  }

  const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1&LH_ItemCondition=3000%7C1000%7C2000&_sop=13&_ipg=10`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = await res.text();

    // Parse sold listings from HTML
    const items = [];
    const itemRegex = /class="s-item__info[^"]*"[\s\S]*?class="s-item__title[^"]*">([\s\S]*?)<\/[^>]+>[\s\S]*?class="s-item__price[^"]*">([\s\S]*?)<\/[^>]+>[\s\S]*?href="(https:\/\/www\.ebay\.com\/itm\/[^"]+)"/g;

    // Simpler approach - extract prices and titles separately
    const titleMatches = [...html.matchAll(/class="s-item__title[^"]*"[^>]*>([\s\S]*?)<\/(?:span|h3|div)>/g)];
    const priceMatches = [...html.matchAll(/class="s-item__price[^"]*"[^>]*>([\s\S]*?)<\/span>/g)];
    const urlMatches = [...html.matchAll(/class="s-item__link[^"]*"\s+href="(https:\/\/www\.ebay\.com\/itm\/[^"]+)"/g)];
    const condMatches = [...html.matchAll(/class="SECONDARY_INFO[^"]*"[^>]*>([\s\S]*?)<\/span>/g)];

    const noiseWords = ['proxy', 'playmat', 'sleeve', 'lot of', 'custom', 'alter', 'reprint', 'fake', 'token', 'bundle'];

    for (let i = 0; i < Math.min(titleMatches.length, priceMatches.length, 10); i++) {
      const title = titleMatches[i]?.[1]?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim() || '';
      const priceRaw = priceMatches[i]?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
      const price = parseFloat(priceRaw.replace(/[^0-9.]/g, '')) || 0;
      const itemUrl = urlMatches[i]?.[1] || '';
      const condition = condMatches[i]?.[1]?.replace(/<[^>]+>/g, '').trim() || '';

      if (!title || title.includes('Shop on eBay') || price === 0) continue;
      if (noiseWords.some(w => title.toLowerCase().includes(w))) continue;

      items.push({ title, price, url: itemUrl, condition });
      if (items.length >= 5) break;
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ items })
    };

  } catch(e) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: e.message }) };
  }
};
