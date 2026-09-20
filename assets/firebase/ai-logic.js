/**
 * GLP-1 Companion v5.0 Firebase AI Logic module.
 * Phase 4 shares the same modular Firebase app + App Check instance used by
 * Auth and Firestore. AI behavior is intentionally unchanged from Phase 3.
 */
import { getAI, getGenerativeModel, GoogleAIBackend } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js';
import { firebaseApp } from './platform.js';

const AI_MODELS = Object.freeze({
  primary: 'gemini-3.5-flash',
  fallback: 'gemini-3.5-flash-lite'
});
window.firebaseAiModels = AI_MODELS;

try {
  const aiService = getAI(firebaseApp, { backend: new GoogleAIBackend() });

  window.firebaseAiAnalyzeMeal = async ({ systemPrompt, prompt, imageBase64, mimeType, modelName }) => {
    const selectedModel = modelName === AI_MODELS.fallback ? AI_MODELS.fallback : AI_MODELS.primary;
    const responseSchema = {
      type: 'object',
      properties: {
        foodNameEs: { type: 'string', nullable: false },
        foodNameEn: { type: 'string', nullable: false },
        calories: { type: 'number', nullable: false },
        protein: { type: 'number', nullable: false },
        carbs: { type: 'number', nullable: false },
        fat: { type: 'number', nullable: false },
        tipEs: { type: 'string', nullable: false },
        tipEn: { type: 'string', nullable: false }
      },
      required: ['foodNameEs', 'foodNameEn', 'calories', 'protein', 'carbs', 'fat', 'tipEs', 'tipEn'],
      nullable: false
    };
    const model = getGenerativeModel(aiService, {
      model: selectedModel,
      systemInstruction: systemPrompt,
      generationConfig: { responseMimeType: 'application/json', responseSchema }
    });
    const parts = [prompt];
    if (imageBase64) parts.push({ inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } });
    const result = await model.generateContent(parts);
    const text = result?.response?.text?.();
    if (!text) throw new Error('Empty Firebase AI Logic response');
    return JSON.parse(text);
  };

  window.firebaseAiTranslateMeal = async ({ foodName, tip, modelName }) => {
    const selectedModel = modelName === AI_MODELS.fallback ? AI_MODELS.fallback : AI_MODELS.primary;
    const responseSchema = {
      type: 'object',
      properties: {
        foodNameEs: { type: 'string', nullable: false },
        foodNameEn: { type: 'string', nullable: false },
        tipEs: { type: 'string', nullable: false },
        tipEn: { type: 'string', nullable: false }
      },
      required: ['foodNameEs', 'foodNameEn', 'tipEs', 'tipEn'],
      nullable: false
    };
    const model = getGenerativeModel(aiService, {
      model: selectedModel,
      systemInstruction: 'You normalize a previously saved GLP-1 meal-log analysis into a bilingual record. Detect the source language automatically. Return a natural Spanish meal name and tolerance note plus a natural English meal name and tolerance note. Translate faithfully and concisely. Do not add nutrition facts, medical claims, diagnoses, or medication advice.',
      generationConfig: { responseMimeType: 'application/json', responseSchema }
    });
    const result = await model.generateContent([`Saved meal name: ${String(foodName || '')}\nSaved tolerance note: ${String(tip || '')}`]);
    const text = result?.response?.text?.();
    if (!text) throw new Error('Empty Firebase AI Logic translation response');
    return JSON.parse(text);
  };
  window.firebaseAiLogicReady = true;
} catch (error) {
  console.error('Firebase AI Logic initialization failed:', error);
  window.firebaseAiLogicReady = false;
  window.firebaseAiLogicInitError = String(error?.message || error || 'Unknown AI initialization error');
}
