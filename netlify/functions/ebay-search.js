exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const query = params.query || '';
  const appId = params.appId || '';

  if (!query || !appId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query or appId', params }) };
  }

  const url = `https://svcs.ebay.com/services/search/FindingService/v1` +
    `?OPERATION-NAME=findCompletedItems` +
    `&SERVICE-VERSION=1.0.0` +
    `&SECURITY-APPNAME=${encodeURIComponent(appId)}` +
    `&RESPONSE-DATA-FORMAT=JSON` +
    `&keywords=${encodeURIComponent(query)}` +
    `&categoryId=2536` +
    `&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true` +
    `&sortOrder=EndTimeSoonest` +
    `&paginationInput.entriesPerPage=8`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { 
      return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Bad JSON', raw: text.substring(0, 500) }) };
    }
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    const noiseWords = ['proxy', 'playmat', 'sleeve', 'lot ', 'custom', 'alter', 'reprint', 'fake', 'token', 'bundle'];
    const filtered = items.filter(item => {
      const title = (item.title?.[0] || '').toLowerCase();
      return !noiseWords.some(w => title.includes(w));
    });
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ items: filtered.slice(0, 5), total: items.length, url: url.substring(0, 200) })
    };
  } catch(e) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: e.message }) };
  }
};
