const EUDR_REFERENCE_SNIPPETS = [
  {
    title: 'EU Deforestation Regulation — European Commission',
    url: 'https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en',
    snippet: 'The EU Deforestation Regulation (EUDR) ensures commodities placed on the EU market are deforestation-free and legally produced.',
  },
  {
    title: 'EUDR Information System',
    url: 'https://green-forum.ec.europa.eu/nature-and-biodiversity/deforestation-regulation-implementation/information-system-deforestation-regulation_en',
    snippet: 'Operators submit Due Diligence Statements through the EU TRACES-based information system.',
  },
];

async function searchDuckDuckGo(query, maxResults = 5) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];

  const data = await res.json();
  const results = [];

  if (data.AbstractText) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL || '',
      snippet: data.AbstractText.slice(0, 400),
      source: 'duckduckgo',
    });
  }

  const topics = data.RelatedTopics || [];
  for (const topic of topics) {
    if (results.length >= maxResults) break;
    if (topic.Text && topic.FirstURL) {
      results.push({
        title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 80),
        url: topic.FirstURL,
        snippet: topic.Text.slice(0, 300),
        source: 'duckduckgo',
      });
    } else if (topic.Topics) {
      for (const sub of topic.Topics) {
        if (results.length >= maxResults) break;
        if (sub.Text && sub.FirstURL) {
          results.push({
            title: sub.Text.split(' - ')[0] || sub.Text.slice(0, 80),
            url: sub.FirstURL,
            snippet: sub.Text.slice(0, 300),
            source: 'duckduckgo',
          });
        }
      }
    }
  }

  return results.slice(0, maxResults);
}

async function searchSerper(query, apiKey, maxResults = 5) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({ q: query, num: maxResults }),
  });

  if (!res.ok) {
    throw new Error(`Serper search failed (${res.status})`);
  }

  const data = await res.json();
  return (data.organic || []).slice(0, maxResults).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet || '',
    source: 'serper',
  }));
}

async function searchWeb(query, settings) {
  const maxResults = settings.web_search?.max_results || 5;
  const enrichedQuery = `${query} EUDR deforestation regulation Uganda coffee cocoa compliance`;

  let results = [];

  if (settings.web_search?.serper_api_key) {
    try {
      results = await searchSerper(enrichedQuery, settings.web_search.serper_api_key, maxResults);
    } catch (err) {
      console.warn('Serper search failed:', err.message);
    }
  }

  if (results.length < 2) {
    const ddg = await searchDuckDuckGo(enrichedQuery, maxResults);
    const seen = new Set(results.map((r) => r.url));
    for (const r of ddg) {
      if (!seen.has(r.url)) results.push(r);
    }
  }

  for (const ref of EUDR_REFERENCE_SNIPPETS) {
    if (results.length >= maxResults) break;
    if (!results.some((r) => r.url === ref.url)) {
      results.push({ ...ref, source: 'reference' });
    }
  }

  return results.slice(0, maxResults);
}

function formatSearchResultsForPrompt(results) {
  if (!results.length) {
    return 'No internet search results found. Answer from platform compliance data and general EUDR knowledge.';
  }

  return [
    '=== INTERNET / REFERENCE SOURCES (cite when used) ===',
    ...results.map((r, i) => (
      `[${i + 1}] ${r.title}\nURL: ${r.url || 'n/a'}\n${r.snippet}`
    )),
    '',
    'Prefer official EU and MAAIF sources. Note when information comes from web search vs platform data.',
  ].join('\n\n');
}

module.exports = {
  searchWeb,
  formatSearchResultsForPrompt,
};
