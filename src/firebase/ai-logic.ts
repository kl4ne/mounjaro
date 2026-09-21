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

  window.firebaseAiPatternFinder = async ({
    contextJson,
    modelName
  }: PatternFinderAiRequest): Promise<JsonRecord> => {
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
        patternsEs: Schema.string(),
        patternsEn: Schema.string(),
        cautionEs: Schema.string(),
        cautionEn: Schema.string(),
        coverageEs: Schema.string(),
        coverageEn: Schema.string()
      }
    });

    const model = getGenerativeModel(aiService, {
      model: selectedModel,
      systemInstruction:
        'You are the AI Pattern Finder inside GLP-1 Companion. The app has already calculated candidate associations from the user\'s own tracking records. ' +
        'Use ONLY the supplied JSON candidates and coverage. Do not invent additional patterns, recalculate evidence in a way that contradicts the app, or infer causation. ' +
        'Never diagnose a condition and never recommend changing, increasing, decreasing, delaying, or skipping medication. ' +
        'If candidate evidence is weak or absent, say that clearly. Describe associations as observations in recorded data, not causes. ' +
        'patternsEs and patternsEn should be concise bullet-style lines separated by newline characters, preserving the evidence counts or values supplied by the app. ' +
        'caution must explicitly remind the user that association does not establish cause. Return equivalent natural Spanish and English content.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const prompt =
      `APP-CALCULATED PATTERN CONTEXT JSON (authoritative; do not add facts outside it):\n${contextJson}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) throw new Error('Empty Firebase AI Logic Pattern Finder response');
    return parseJsonResponse(text);
  };

  window.firebaseAiPrepareVisit = async ({
    contextJson,
    modelName
  }: PrepareVisitAiRequest): Promise<JsonRecord> => {
    const selectedModel =
      modelName === AI_MODELS.fallback
        ? AI_MODELS.fallback
        : AI_MODELS.primary;

    const responseSchema = Schema.object({
      properties: {
        summaryEs: Schema.string(),
        summaryEn: Schema.string(),
        highlightsEs: Schema.string(),
        highlightsEn: Schema.string(),
        discussionEs: Schema.string(),
        discussionEn: Schema.string(),
        gapsEs: Schema.string(),
        gapsEn: Schema.string(),
        coverageEs: Schema.string(),
        coverageEn: Schema.string()
      }
    });

    const model = getGenerativeModel(aiService, {
      model: selectedModel,
      systemInstruction:
        'You prepare a concise visit-preparation summary from GLP-1 Companion tracking data. Use ONLY the app-calculated JSON. ' +
        'This is organization of personal records, not medical advice. Do not diagnose, claim causation, assess treatment effectiveness, or recommend any medication/dose change. ' +
        'highlights should summarize documented trends, counts and values. discussion should be neutral topics or questions the user may choose to discuss with a healthcare professional, not instructions. ' +
        'gaps should identify missing or sparse tracking that limits interpretation. When data are limited, make that limitation clear. ' +
        'Return equivalent natural Spanish and English. For highlights, discussion and gaps, use concise bullet-style lines separated by newline characters.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const prompt =
      `VISIT PREPARATION CONTEXT JSON (authoritative; do not use facts outside it):\n${contextJson}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) throw new Error('Empty Firebase AI Logic Prepare My Visit response');
    return parseJsonResponse(text);
  };

  window.firebaseAiProgressComparison = async ({
    contextJson,
    modelName
  }: ProgressComparisonAiRequest): Promise<JsonRecord> => {
    const selectedModel =
      modelName === AI_MODELS.fallback
        ? AI_MODELS.fallback
        : AI_MODELS.primary;

    const responseSchema = Schema.object({
      properties: {
        summaryEs: Schema.string(),
        summaryEn: Schema.string(),
        changesEs: Schema.string(),
        changesEn: Schema.string(),
        watchEs: Schema.string(),
        watchEn: Schema.string(),
        coverageEs: Schema.string(),
        coverageEn: Schema.string()
      }
    });

    const model = getGenerativeModel(aiService, {
      model: selectedModel,
      systemInstruction:
        'You explain a deterministic comparison between two saved GLP-1 Companion tracking reports. ' +
        'Use ONLY the supplied JSON comparison and its app-calculated deltas. Do not invent facts, diagnose, claim causation, assess treatment effectiveness, or recommend medication/dose changes. ' +
        'Describe changes neutrally and distinguish improvement, worsening, and simple numeric movement only when the app data directly supports that wording. ' +
        'If coverage differs or evidence is sparse, emphasize that limitation. Return equivalent natural Spanish and English. ' +
        'changesEs/changesEn and watchEs/watchEn should use concise bullet-style lines separated by newline characters.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema
      }
    });

    const prompt =
      `APP-CALCULATED PROGRESS COMPARISON JSON (authoritative; do not use facts outside it):\n${contextJson}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    if (!text) throw new Error('Empty Firebase AI Logic progress comparison response');
    return parseJsonResponse(text);
  };

  window.firebaseAiPersonalProgress = async ({ contextJson, modelName }: PersonalProgressAiRequest): Promise<JsonRecord> => {
    const selectedModel = modelName === AI_MODELS.fallback ? AI_MODELS.fallback : AI_MODELS.primary;
    const responseSchema = Schema.object({ properties: { summaryEs: Schema.string(), summaryEn: Schema.string(), observationsEs: Schema.string(), observationsEn: Schema.string(), limitationsEs: Schema.string(), limitationsEn: Schema.string(), discussionEs: Schema.string(), discussionEn: Schema.string() } });
    const model = getGenerativeModel(aiService, {
      model: selectedModel,
      systemInstruction: 'Explain personal progress using ONLY the supplied app-calculated JSON. Respect its coverage rule: comparisons require at least 4 logged days in both 7-day periods. Treat missing data as missing, never as zero. Goals are user-configured and must not be invented. Mention symptoms only when explicitly recorded. Do not diagnose, claim causation or treatment effectiveness, or recommend medication or dose changes. Use neutral, supportive language. Return equivalent natural Spanish and English. observations and limitations use concise bullet-style lines separated by newline characters; discussion is an optional neutral topic the user may discuss with a healthcare professional.',
      generationConfig: { responseMimeType: 'application/json', responseSchema }
    });
    const result = await model.generateContent(`APP-CALCULATED PERSONAL PROGRESS JSON (authoritative; do not use facts outside it):\n${contextJson}`);
    const text = result.response.text();
    if (!text) throw new Error('Empty Firebase AI Logic personal progress response');
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
