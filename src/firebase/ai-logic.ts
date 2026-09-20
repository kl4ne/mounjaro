/**
 * GLP-1 Companion Firebase AI Logic module.
 * Shares the same modular Firebase app + App Check instance used by Auth and Firestore.
 */
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  Schema,
  type Part
} from 'firebase/ai';

import { firebaseApp } from './platform.js';

const AI_MODELS = Object.freeze({
  primary: 'gemini-3.5-flash',
  fallback: 'gemini-3.5-flash-lite'
});

window.firebaseAiModels = AI_MODELS;

type JsonRecord = Record<string, unknown>;

function parseJsonResponse(text: string): JsonRecord {
  const parsed: unknown = JSON.parse(text);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Firebase AI Logic returned a non-object JSON response');
  }

  return parsed as JsonRecord;
}

try {
  const aiService = getAI(firebaseApp, {
    backend: new GoogleAIBackend()
  });

  window.firebaseAiAnalyzeMeal = async ({
    systemPrompt,
    prompt,
    imageBase64,
    mimeType,
    modelName
  }: MealAiRequest): Promise<JsonRecord> => {
    const selectedModel =
      modelName === AI_MODELS.fallback
        ? AI_MODELS.fallback
        : AI_MODELS.primary;

    const responseSchema = Schema.object({
      properties: {
        foodNameEs: Schema.string(),
        foodNameEn: Schema.string(),
        calories: Schema.number(),
        protein: Schema.number(),
        carbs: Schema.number(),
        fat: Schema.number(),
        tipEs: Schema.string(),
        tipEn: Schema.string()
      }
    });

    const model = getGenerativeModel(aiService, {
      model: selectedModel,
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const parts: Array<string | Part> = [prompt];

    if (imageBase64) {
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || 'image/jpeg'
        }
      });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();

    if (!text) {
      throw new Error('Empty Firebase AI Logic response');
    }

    return parseJsonResponse(text);
  };

  window.firebaseAiTranslateMeal = async ({
    foodName,
    tip,
    modelName
  }: MealTranslationRequest): Promise<JsonRecord> => {
    const selectedModel =
      modelName === AI_MODELS.fallback
        ? AI_MODELS.fallback
        : AI_MODELS.primary;

    const responseSchema = Schema.object({
      properties: {
        foodNameEs: Schema.string(),
        foodNameEn: Schema.string(),
        tipEs: Schema.string(),
        tipEn: Schema.string()
      }
    });

    const model = getGenerativeModel(aiService, {
      model: selectedModel,
      systemInstruction:
        'You normalize a previously saved GLP-1 meal-log analysis into a bilingual record. ' +
        'Detect the source language automatically. Return a natural Spanish meal name and ' +
        'tolerance note plus a natural English meal name and tolerance note. Translate ' +
        'faithfully and concisely. Do not add nutrition facts, medical claims, diagnoses, ' +
        'or medication advice.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const prompt =
      `Saved meal name: ${String(foodName || '')}\n` +
      `Saved tolerance note: ${String(tip || '')}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text) {
      throw new Error('Empty Firebase AI Logic translation response');
    }

    return parseJsonResponse(text);
  };

  window.firebaseAiAskMyData = async ({
    question,
    contextJson,
    modelName
  }: AskMyDataAiRequest): Promise<JsonRecord> => {
    const selectedModel =
      modelName === AI_MODELS.fallback
        ? AI_MODELS.fallback
        : AI_MODELS.primary;

    const responseSchema = Schema.object({
      properties: {
        answerEs: Schema.string(),
        answerEn: Schema.string(),
        evidenceEs: Schema.string(),
        evidenceEn: Schema.string(),
        coverageEs: Schema.string(),
        coverageEn: Schema.string()
      }
    });

    const model = getGenerativeModel(aiService, {
      model: selectedModel,
      systemInstruction:
        'You are the data-explanation assistant inside GLP-1 Companion. Answer ONLY from the structured tracking context provided by the app. ' +
        'The app has already calculated the numeric summaries; do not recalculate them in a way that contradicts the supplied values. ' +
        'Never invent records, dates, causal relationships, diagnoses, or medication recommendations. Never advise changing, skipping, increasing, or decreasing a medication dose. ' +
        'When data are insufficient, say so clearly. Correlations must be described as recorded associations, not causes. ' +
        'Return the same answer in natural Spanish and English. Evidence should be concise bullet-style lines separated by newline characters and should reference dates, counts, or supplied summary values when useful. ' +
        'Coverage should briefly state how much recorded data supports the answer. This is an informational summary of the user\'s own records, not medical advice.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const prompt =
      `USER QUESTION:\n${String(question || '').trim()}\n\n` +
      `TRACKING CONTEXT JSON (authoritative; do not use facts outside it):\n${contextJson}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text) {
      throw new Error('Empty Firebase AI Logic Ask My Data response');
    }

    return parseJsonResponse(text);
  };

  window.firebaseAiWeeklyCheckIn = async ({
    contextJson,
    modelName
  }: WeeklyCheckInAiRequest): Promise<JsonRecord> => {
    const selectedModel =
      modelName === AI_MODELS.fallback
        ? AI_MODELS.fallback
        : AI_MODELS.primary;

    const responseSchema = Schema.object({
      properties: {
        headlineEs: Schema.string(),
        headlineEn: Schema.string(),
        summaryEs: Schema.string(),
        summaryEn: Schema.string(),
        positiveEs: Schema.string(),
        positiveEn: Schema.string(),
        watchEs: Schema.string(),
        watchEn: Schema.string(),
        coverageEs: Schema.string(),
        coverageEn: Schema.string()
      }
    });

    const model = getGenerativeModel(aiService, {
      model: selectedModel,
      systemInstruction:
        'You create a weekly GLP-1 tracking check-in from app-calculated data. Use ONLY the supplied JSON. ' +
        'Compare the current 7-day period with the preceding 7-day period only when both contain enough recorded data. ' +
        'Do not diagnose, claim causation, or recommend medication changes. Do not shame the user or label behavior as good/bad. ' +
        'If tracking coverage is sparse, make that limitation prominent. Provide the same content in Spanish and English. ' +
        'positive should mention one or two constructive recorded changes when supported. watch should mention one or two neutral items worth monitoring, not treatment instructions. ' +
        'This is a summary of personal records, not medical advice.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const prompt =
      `WEEKLY TRACKING CONTEXT JSON (authoritative; do not use facts outside it):\n${contextJson}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text) {
      throw new Error('Empty Firebase AI Logic weekly check-in response');
    }

    return parseJsonResponse(text);
  };

  window.firebaseAiLogicReady = true;
  window.firebaseAiLogicInitError = '';

} catch (error: unknown) {
  console.error('Firebase AI Logic initialization failed:', error);

  window.firebaseAiLogicReady = false;
  window.firebaseAiLogicInitError =
    error instanceof Error
      ? error.message
      : String(error || 'Unknown AI initialization error');
}
