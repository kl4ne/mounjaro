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
  }: MealAiRequest) => {
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
    const text = result?.response?.text?.();

    if (!text) {
      throw new Error('Empty Firebase AI Logic response');
    }

    return parseJsonResponse(text);
  };

  window.firebaseAiTranslateMeal = async ({
    foodName,
    tip,
    modelName
  }: MealTranslationRequest) => {
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

    const result = await model.generateContent(
      `Saved meal name: ${String(foodName || '')}\n` +
      `Saved tolerance note: ${String(tip || '')}`
    );

    const text = result?.response?.text?.();

    if (!text) {
      throw new Error('Empty Firebase AI Logic translation response');
    }

    return parseJsonResponse(text);
  };

  window.firebaseAiLogicReady = true;

} catch (error: unknown) {
  console.error('Firebase AI Logic initialization failed:', error);

  window.firebaseAiLogicReady = false;

  window.firebaseAiLogicInitError =
    error instanceof Error
      ? error.message
      : String(error || 'Unknown AI initialization error');
}
