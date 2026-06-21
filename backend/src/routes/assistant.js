const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { authMiddleware } = require('../middleware/auth');
const { listModels, resolveModel, chat, buildComplianceContext } = require('../services/aiAssistant');
const { getEffectiveSettings, saveSettings, getAdminView } = require('../services/aiSettings');

const router = express.Router();

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(header.slice(7), config.jwtSecret);
  } catch {
    req.user = null;
  }
  next();
}

router.get('/config', async (req, res) => {
  try {
    const settings = await getEffectiveSettings();
    res.json({
      enabled: settings.enabled,
      default_model: settings.default_model,
      pro_requires_auth: settings.pro_requires_auth,
      include_compliance_data: settings.include_compliance_data,
      search_internet_enabled: settings.search_internet_enabled,
      search_internet_default: settings.search_internet_default,
      models: await listModels(settings),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/config', authMiddleware, async (req, res) => {
  try {
    const view = await getAdminView();
    const preview = await buildComplianceContext();
    res.json({ ...view, compliance_context_preview: preview });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/admin/config', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const patch = {};

    if (body.enabled !== undefined) patch.enabled = !!body.enabled;
    if (body.default_model) patch.default_model = body.default_model;
    if (body.pro_requires_auth !== undefined) patch.pro_requires_auth = !!body.pro_requires_auth;
    if (body.include_compliance_data !== undefined) patch.include_compliance_data = !!body.include_compliance_data;
    if (body.search_internet_enabled !== undefined) patch.search_internet_enabled = !!body.search_internet_enabled;
    if (body.search_internet_default !== undefined) patch.search_internet_default = !!body.search_internet_default;
    if (body.system_prompt_extra !== undefined) patch.system_prompt_extra = String(body.system_prompt_extra).slice(0, 2000);

    if (body.providers) {
      patch.providers = {};
      for (const [name, prov] of Object.entries(body.providers)) {
        patch.providers[name] = {};
        if (prov.api_key) patch.providers[name].api_key = prov.api_key;
        if (prov.base_url !== undefined) patch.providers[name].base_url = prov.base_url;
        if (prov.model !== undefined) patch.providers[name].model = prov.model;
      }
    }

    if (body.web_search) {
      patch.web_search = {};
      if (body.web_search.provider) patch.web_search.provider = body.web_search.provider;
      if (body.web_search.max_results) patch.web_search.max_results = parseInt(body.web_search.max_results, 10);
      if (body.web_search.serper_api_key) patch.web_search.serper_api_key = body.web_search.serper_api_key;
    }

    await saveSettings(patch);
    const view = await getAdminView();
    res.json({ message: 'AI configuration saved', settings: view });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/compliance-preview', authMiddleware, async (req, res) => {
  try {
    const context = await buildComplianceContext();
    res.json({ context, length: context.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/chat', optionalAuth, async (req, res) => {
  const settings = await getEffectiveSettings();
  if (!settings.enabled) {
    return res.status(503).json({ error: 'AI assistant is disabled' });
  }

  const {
    model: modelId,
    messages,
    include_compliance_data: includeComplianceData,
    search_internet: searchInternet,
  } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const sanitized = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (!sanitized.length) {
    return res.status(400).json({ error: 'No valid messages' });
  }

  try {
    const model = resolveModel(modelId || settings.default_model, settings);
    if (model.tier === 'pro' && settings.pro_requires_auth && !req.user) {
      return res.status(403).json({
        error: 'Pro models require officer login',
        login_url: '/management',
      });
    }

    const useCompliance = includeComplianceData !== false;
    const useSearch = searchInternet === true
      || (searchInternet !== false && settings.search_internet_default);

    const result = await chat({
      modelId: model.id,
      messages: sanitized,
      includeComplianceData: useCompliance,
      searchInternet: useSearch && settings.search_internet_enabled,
    });

    res.json({
      reply: result.content,
      model: result.model,
      provider: result.provider,
      note: result.note || null,
      sources: result.sources || [],
      used_compliance_data: result.used_compliance_data,
      used_web_search: result.used_web_search,
    });
  } catch (err) {
    console.error('Assistant error:', err.message);
    res.status(502).json({ error: err.message || 'Assistant unavailable' });
  }
});

module.exports = router;
