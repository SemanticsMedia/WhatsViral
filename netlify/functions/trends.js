// Netlify serverless function â€” fetches Google Trends RSS server-side
// This runs on Netlify's servers, so no CORS restrictions apply
// Endpoint: /.netlify/functions/trends?geo=IN

exports.handler = async (event) => {
  const geo = event.queryStringParameters?.geo || '';
  const url = `https://trends.google.com/trends/trendingsearches/daily/rss${geo ? `?geo=${geo}` : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhatsViral/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Google Trends fetch failed', status: response.status }),
      };
    }

    const xml = await response.text();

    // Parse XML server-side â€” extract items cleanly
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                     block.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || '';
      const traffic = (block.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/))?.[1]?.trim() || '';

      // Get first news item snippet as description
      const snippetMatch = block.match(/<ht:news_item_snippet><!\[CDATA\[([\s\S]*?)\]\]><\/ht:news_item_snippet>/) ||
                           block.match(/<ht:news_item_snippet>([\s\S]*?)<\/ht:news_item_snippet>/);
      const snippet = snippetMatch?.[1]?.trim() || '';

      // Get news item title for extra context
      const newsTitleMatch = block.match(/<ht:news_item_title><!\[CDATA\[(.*?)\]\]><\/ht:news_item_title>/);
      const newsTitle = newsTitleMatch?.[1]?.trim() || '';

      if (!title) continue;

      // Parse traffic into a 0-100 value
      let trafficValue = 50;
      const t = traffic.replace(/\+/g, '').trim();
      if (t.toLowerCase().includes('m')) {
        trafficValue = Math.min(98, Math.round(parseFloat(t) * 2 + 60));
      } else if (t.toLowerCase().includes('k')) {
        const k = parseFloat(t);
        if (k >= 500) trafficValue = 90;
        else if (k >= 200) trafficValue = 80;
        else if (k >= 100) trafficValue = 70;
        else if (k >= 50) trafficValue = 62;
        else trafficValue = 52;
      }

      items.push({ title, traffic, trafficValue, snippet, newsTitle });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // cache 5 mins
      },
      body: JSON.stringify({ items, geo, fetchedAt: new Date().toISOString() }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
