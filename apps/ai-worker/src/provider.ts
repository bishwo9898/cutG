import type { HairPreferences } from '@barber-saas/shared-types';
import { GoogleGenAI, Modality, type Part } from '@google/genai';

import { config } from './config';
import {
  buildHairEditPrompt,
  buildSuggestionPrompt,
  HAIR_PRESET_CATALOG,
  pickMockSuggestions,
} from './prompts';

export type CaptureInput = { angle: string; mimeType: string; bytes: Buffer };
export type ProviderUsage = {
  inputUnits: number;
  outputUnits: number;
  raw: Record<string, unknown>;
};
export type Suggestion = {
  id: string;
  name: string;
  category: string;
  description: string;
  reason: string;
};
export type SuggestionResult = {
  suggestions: Suggestion[];
  requestId: string | null;
  usage: ProviderUsage;
};
export type GenerationResult = {
  image: Buffer;
  mimeType: string;
  requestId: string | null;
  usage: ProviderUsage;
  estimatedCostCents: number;
};

export interface HairAiProvider {
  suggest(captures: CaptureInput[], preferences: HairPreferences): Promise<SuggestionResult>;
  generate(
    captures: CaptureInput[],
    style: { styleName: string; description: string | null },
  ): Promise<GenerationResult>;
}

const emptyUsage = (): ProviderUsage => ({ inputUnits: 0, outputUnits: 0, raw: {} });

export class MockHairAiProvider implements HairAiProvider {
  public suggest(
    _captures: CaptureInput[],
    preferences: HairPreferences,
  ): Promise<SuggestionResult> {
    return Promise.resolve({
      suggestions: pickMockSuggestions(preferences),
      requestId: 'mock-suggestion',
      usage: emptyUsage(),
    });
  }

  public generate(captures: CaptureInput[]): Promise<GenerationResult> {
    if (process.env.AI_MOCK_FAILURE === 'true') {
      return Promise.reject(new Error('MOCK_PROVIDER_FAILURE'));
    }
    const front = captures.find((capture) => capture.angle === 'FRONT') ?? captures[0];
    if (front === undefined)
      return Promise.reject(new Error('No reference capture was available.'));
    return Promise.resolve({
      image: front.bytes,
      mimeType: front.mimeType,
      requestId: 'mock-generation',
      usage: emptyUsage(),
      estimatedCostCents: 0,
    });
  }
}

const providerParts = (captures: CaptureInput[], prompt: string): Part[] => [
  { text: prompt },
  ...captures.map((capture) => ({
    inlineData: { data: capture.bytes.toString('base64'), mimeType: capture.mimeType },
  })),
];

const mapUsage = (usage: unknown): ProviderUsage => {
  const raw = (usage ?? {}) as Record<string, unknown>;
  return {
    inputUnits: Number(raw.promptTokenCount ?? 0),
    outputUnits: Number(raw.candidatesTokenCount ?? raw.totalTokenCount ?? 0),
    raw,
  };
};

const validateSuggestions = (value: unknown): Suggestion[] => {
  if (!Array.isArray(value)) throw new Error('Provider returned an invalid recommendation list.');
  const allowed = new Set(HAIR_PRESET_CATALOG.map((preset) => preset.id));
  const suggestions = value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .filter((item) => typeof item.id === 'string' && allowed.has(item.id as never))
    .slice(0, 3)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name ?? ''),
      category: String(item.category ?? 'haircut'),
      description: String(item.description ?? ''),
      reason: String(item.reason ?? '').slice(0, 200),
    }));
  if (suggestions.length !== 3) throw new Error('Provider did not return three catalog styles.');
  return suggestions;
};

export class GeminiHairAiProvider implements HairAiProvider {
  private readonly client = new GoogleGenAI({ apiKey: config.geminiApiKey });

  public async suggest(
    captures: CaptureInput[],
    preferences: HairPreferences,
  ): Promise<SuggestionResult> {
    const response = await this.client.models.generateContent({
      model: config.geminiSuggestionModel,
      contents: [
        { role: 'user', parts: providerParts(captures, buildSuggestionPrompt(preferences)) },
      ],
      config: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    return {
      suggestions: validateSuggestions(JSON.parse(response.text ?? '[]')),
      requestId: response.responseId ?? null,
      usage: mapUsage(response.usageMetadata),
    };
  }

  public async generate(
    captures: CaptureInput[],
    style: { styleName: string; description: string | null },
  ): Promise<GenerationResult> {
    const response = await this.client.models.generateContent({
      model: config.geminiImageModel,
      contents: [{ role: 'user', parts: providerParts(captures, buildHairEditPrompt(style)) }],
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });
    const image = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data !== undefined,
    )?.inlineData;
    if (image?.data === undefined) throw new Error('Provider returned no generated image.');
    return {
      image: Buffer.from(image.data, 'base64'),
      mimeType: image.mimeType ?? 'image/png',
      requestId: response.responseId ?? null,
      usage: mapUsage(response.usageMetadata),
      estimatedCostCents: 6.7,
    };
  }
}

export const createProvider = (): HairAiProvider =>
  config.provider === 'gemini' ? new GeminiHairAiProvider() : new MockHairAiProvider();
