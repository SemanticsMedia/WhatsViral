'use strict';

/**
 * AI service wrapper — provider-agnostic from day one.
 * B2B: Claude Sonnet. Consumer: Gemini. Each switchable independently.
 * Component 48: provider-agnostic wrapper
 * Component 49: cost monitoring (every call logged to ai_usage_log)
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ai } = require('../config/env');
const { query } = require('../config/database');
const logger = require('../utils/logger');

let geminiClient = null;

function getGemini() {
  if (!geminiClient) geminiClient = new GoogleGenerativeAI(ai.geminiApiKey);
  return geminiClient;
}

async function generateConsumer(prompt, feature) {
  if (ai.consumer.provider === 'gemini') return generateWithGemini(prompt, feature);
  throw new Error(`Unknown consumer AI provider: ${ai.consumer.provider}`);
}

async function generateB2B(prompt, feature) {
  if (ai.b2b.provider === 'claude') return generateWithClaude(prompt, feature);
  if (ai.b2b.provider === 'gemini') return generateWithGemini(prompt, feature);
  throw new Error(`Unknown B2B AI provider: ${ai.b2b.provider}`);
}

async function generateWithGemini(prompt, feature) {
  const start = Date.now();
  try {
    const model = getGemini().getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    await logUsage('gemini', feature, null, null, text.length / 4, Date.now() - start, true);
    return text;
  } catch (err) {
    await logUsage('gemini', feature, null, null, 0, Date.now() - start, false, err.message);
    throw err;
  }
}

async function generateWithClaude(prompt, feature) {
  if (!ai.claudeApiKey) {
    logger.warn('Claude API key not configured, falling back to Gemini');
    return generateWithGemini(prompt, feature);
  }
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: ai.claudeApiKey });
  const start = Date.now();
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content[0].text;
    await logUsage('claude', feature, message.usage?.input_tokens, message.usage?.output_tokens, 0, Date.now() - start, true);
    return text;
  } catch (err) {
    await logUsage('claude', feature, 0, 0, 0, Date.now() - start, false, err.message);
    throw err;
  }
}

async function logUsage(provider, feature, tokensIn, tokensOut, approxTokens, durationMs, success, errorMsg = null) {
  const costPer1kIn  = provider === 'claude' ? 0.003 : 0.000075;
  const costPer1kOut = provider === 'claude' ? 0.015  : 0.0003;
  const tIn  = tokensIn  || approxTokens || 0;
  const tOut = tokensOut || approxTokens || 0;
  const cost = (tIn / 1000 * costPer1kIn) + (tOut / 1000 * costPer1kOut);

  try {
    await query(
      `INSERT INTO ai_usage_log (provider, feature, tokens_in, tokens_out, estimated_cost_usd, duration_ms, success, error_msg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [provider, feature, tIn, tOut, cost, durationMs, success, errorMsg]
    );
  } catch (logErr) {
    logger.warn('Failed to log AI usage', { error: logErr.message });
  }
}

module.exports = { generateConsumer, generateB2B };
