exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const query = params.query || '';
  const appId = params.appId || '';

  if (!query || !appId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing query or appId' }) };
  }

  const noiseWords = ['proxy', 'playmat', 'sleeve', 'lot ', 'custom', 'alter', 'reprint', 'fake', 'token', 'bundle'];

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
    const data = await res.json();
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    const filtered = items.filter(item => {
      const title = (item.title?.[0] || '').toLowerCase();
      return !noiseWords.some(w => title.includes(w));
    });
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ items: filtered.slice(0, 5) })
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
