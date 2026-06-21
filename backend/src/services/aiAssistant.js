const { getEffectiveSettings, providerReady } = require('./aiSettings');
const { buildComplianceContext } = require('./complianceContext');
const { searchWeb, formatSearchResultsForPrompt } = require('./webSearch');

const BASE_SYSTEM_PROMPT = `You are the MAAIF EUDR Compliance Assistant for Uganda's Ministry of Agriculture, Animal Industry and Fisheries.
You help farmers, exporters, and officers understand the EU Deforestation Regulation (EUDR), farm registration, geospatial plot mapping, supply chain traceability, due diligence statements, and this platform's features (registration hub, USSD *284#, analytics, maps).
Be accurate, practical, and concise. If unsure, say so and suggest contacting a MAAIF district officer or checking official EU guidance.
Never invent legal deadlines or penalties. Focus on Uganda coffee/cocoa export context when relevant.
When platform compliance data or internet sources are provided below, use them and cite the source type (platform data vs web).`;

const MODEL_CATALOG = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', tier: 'standard', envKey: 'openai' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', tier: 'pro', envKey: 'openai' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini', tier: 'standard', envKey: 'gemini' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'gemini', tier: 'pro', envKey: 'gemini' },
  { id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'openai_compat', tier: 'standard', envKey: 'deepseek', modelId: 'deepseek-chat' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', provider: 'openai_compat', tier: 'pro', envKey: 'deepseek', modelId: 'deepseek-reasoner' },
  { id: 'openai-compat', label: 'Custom (OpenAI-compatible)', provider: 'openai_compat', tier: 'standard', envKey: 'custom', modelId: null },
  { id: 'platform-guide', label: 'Platform Guide (offline)', provider: 'fallback', tier: 'standard', envKey: null },
];

async function listModels(settings) {
  const s = settings || await getEffectiveSettings();
  const anyCloud = MODEL_CATALOG.some((m) => m.envKey && providerReady(s, m.envKey));
  return MODEL_CATALOG.filter((m) => {
    if (m.provider === 'fallback') return !anyCloud;
    return providerReady(s, m.envKey);
  }).map(({ id, label, provider, tier }) => ({
    id,
    label,
    provider,
    tier,
    pro: tier === 'pro',
  }));
}

function resolveModel(modelId, settings) {
  let model = MODEL_CATALOG.find((m) => m.id === modelId);
  if (model && model.provider !== 'fallback' && !providerReady(settings, model.envKey)) {
    model = null;
  }
  if (!model) {
    model = MODEL_CATALOG.find((m) => m.id === settings.default_model && providerReady(settings, m.envKey))
      || MODEL_CATALOG.find((m) => m.provider === 'fallback');
  }
  if (!model) throw new Error('No AI models available');
  return model;
}

async function buildSystemPrompt(settings, options = {}) {
  const parts = [BASE_SYSTEM_PROMPT];
  if (settings.system_prompt_extra?.trim()) {
    parts.push(`\nOfficer instructions:\n${settings.system_prompt_extra.trim()}`);
  }
  if (options.complianceContext) {
    parts.push(`\n${options.complianceContext}`);
  }
  if (options.searchContext) {
    parts.push(`\n${options.searchContext}`);
  }
  return parts.join('\n');
}

async function chatOpenAICompat(providerKey, model, messages, systemPrompt, settings) {
  const provider = settings.providers[providerKey];
  const modelName = model.modelId || provider.model || model.id;
  const res = await fetch(`${provider.base_url.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.api_key}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.4,
      max_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI provider error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI provider');
  return { content, model: modelName, provider: providerKey };
}

async function chatGemini(model, messages, systemPrompt, settings) {
  const provider = settings.providers.gemini;
  const modelName = model.id;
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${provider.api_key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty response from Gemini');
  return { content, model: modelName, provider: 'gemini' };
}

function fallbackReply(messages, complianceContext) {
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content?.toLowerCase() || '';
  let content = '';

  if (/district|kabale|mbale|risk|compliance rate|statistics|kpi/.test(last) && complianceContext) {
    const districtMatch = complianceContext.match(/Top districts by compliance rate:[\s\S]*?(?=Recent|$)/);
    content = `Based on **live platform demo data**:\n\n${districtMatch ? districtMatch[0].trim() : complianceContext.slice(0, 800)}\n\nView full analytics at /analytics.`;
  } else if (/register|registration/.test(last)) {
    content = 'Register farmers and exporters at **Registration Hub** (/registration). Field users can dial **USSD *284#**.';
  } else if (/eudr|deforestation|due diligence/.test(last)) {
    content = 'The **EU Deforestation Regulation (EUDR)** requires deforestation-free, legally produced commodities with geolocation and due diligence statements for EU market access.';
  } else if (/complian|risk/.test(last) && complianceContext) {
    const kpi = complianceContext.match(/National KPIs:[\s\S]*?(?=Compliance breakdown)/);
    content = `From platform compliance data:\n\n${kpi ? kpi[0].trim() : 'See /analytics for district compliance rankings.'}`;
  } else {
    content = 'I can help with EUDR compliance, registration, mapping, and supply chain traceability. Enable an AI API key in **Management → AI Configuration** for full model responses.';
  }

  return {
    content,
    model: 'platform-guide',
    provider: 'fallback',
    note: 'Configure API keys in Management → AI Configuration for GPT, Gemini, or DeepSeek.',
  };
}

async function chat({
  modelId,
  messages,
  includeComplianceData,
  searchInternet,
}) {
  const settings = await getEffectiveSettings();
  const model = resolveModel(modelId, settings);

  let complianceContext = null;
  let searchContext = null;
  let sources = [];

  if (includeComplianceData && settings.include_compliance_data) {
    complianceContext = await buildComplianceContext();
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  if (searchInternet && settings.search_internet_enabled) {
    try {
      const results = await searchWeb(lastUser, settings);
      searchContext = formatSearchResultsForPrompt(results);
      sources = results.map((r) => ({ title: r.title, url: r.url, source: r.source }));
    } catch (err) {
      console.warn('Web search failed:', err.message);
      searchContext = 'Internet search temporarily unavailable.';
    }
  }

  const systemPrompt = await buildSystemPrompt(settings, { complianceContext, searchContext });

  if (model.provider === 'fallback') {
    const result = fallbackReply(messages, complianceContext);
    return { ...result, sources, used_compliance_data: !!complianceContext, used_web_search: !!searchContext };
  }

  let result;
  if (model.provider === 'openai') {
    result = await chatOpenAICompat('openai', model, messages, systemPrompt, settings);
  } else if (model.provider === 'openai_compat') {
    result = await chatOpenAICompat(model.envKey, model, messages, systemPrompt, settings);
  } else if (model.provider === 'gemini') {
    result = await chatGemini(model, messages, systemPrompt, settings);
  } else {
    throw new Error('Unsupported provider');
  }

  return {
    ...result,
    sources,
    used_compliance_data: !!complianceContext,
    used_web_search: !!searchContext && sources.length > 0,
  };
}

module.exports = {
  listModels,
  resolveModel,
  chat,
  buildComplianceContext,
  BASE_SYSTEM_PROMPT,
  MODEL_CATALOG,
};
