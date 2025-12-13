/**
 * Model client for AI inference using OpenAI-compatible API.
 */

import OpenAI from "openai";

export interface ModelConfig {
  baseUrl?: string;
  apiKey?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  extraBody?: Record<string, unknown>;
}

export interface ModelResponse {
  thinking: string;
  action: string;
  rawContent: string;
}

export class ModelClient {
  private config: Required<ModelConfig>;
  private client: OpenAI;

  constructor(config: ModelConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? "http://localhost:8000/v1",
      apiKey: config.apiKey ?? "EMPTY",
      modelName: config.modelName ?? "autoglm-phone-9b",
      maxTokens: config.maxTokens ?? 3000,
      temperature: config.temperature ?? 0,
      topP: config.topP ?? 0.85,
      frequencyPenalty: config.frequencyPenalty ?? 0.2,
      extraBody: config.extraBody ?? {},
    };

    this.client = new OpenAI({
      baseURL: this.config.baseUrl,
      apiKey: this.config.apiKey,
    });
  }

  async request(
    messages: OpenAI.ChatCompletionMessageParam[]
  ): Promise<ModelResponse> {
    const stream = await this.client.chat.completions.create({
      messages,
      model: this.config.modelName,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      frequency_penalty: this.config.frequencyPenalty,
      extra_body: this.config.extraBody,
      stream: true,
    });

    let rawContent = "";
    let buffer = "";
    const actionMarkers = ["finish(message=", "do(action="];
    let inActionPhase = false;

    for await (const chunk of stream) {
      if (chunk.choices.length === 0) continue;
      if (chunk.choices[0].delta.content !== null) {
        const content = chunk.choices[0].delta.content;
        rawContent += content;

        if (inActionPhase) {
          continue;
        }

        buffer += content;

        let markerFound = false;
        for (const marker of actionMarkers) {
          if (buffer.includes(marker)) {
            const thinkingPart = buffer.split(marker, 1)[0];
            process.stdout.write(thinkingPart);
            process.stdout.write("\n");
            inActionPhase = true;
            markerFound = true;
            break;
          }
        }

        if (markerFound) continue;

        let isPotentialMarker = false;
        for (const marker of actionMarkers) {
          for (let i = 1; i < marker.length; i++) {
            if (buffer.endsWith(marker.slice(0, i))) {
              isPotentialMarker = true;
              break;
            }
          }
          if (isPotentialMarker) break;
        }

        if (!isPotentialMarker) {
          process.stdout.write(buffer);
          buffer = "";
        }
      }
    }

    const [thinking, action] = this.parseResponse(rawContent);

    return { thinking, action, rawContent };
  }

  private parseResponse(content: string): [string, string] {
    // Rule 1: Check for finish(message=
    if (content.includes("finish(message=")) {
      const parts = content.split("finish(message=", 2);
      const thinking = parts[0].trim();
      const action = "finish(message=" + parts[1];
      return [thinking, action];
    }

    // Rule 2: Check for do(action=
    if (content.includes("do(action=")) {
      const parts = content.split("do(action=", 2);
      const thinking = parts[0].trim();
      const action = "do(action=" + parts[1];
      return [thinking, action];
    }

    // Rule 3: Fallback to legacy XML tag parsing
    if (content.includes("<answer>")) {
      const parts = content.split("<answer>", 2);
      const thinking = parts[0]
        .replace(/<think>/g, "")
        .replace(/<\/think>/g, "")
        .trim();
      const action = parts[1].replace(/<\/answer>/g, "").trim();
      return [thinking, action];
    }

    // Rule 4: No markers found, return content as action
    return ["", content];
  }
}

export class MessageBuilder {
  static createSystemMessage(content: string): OpenAI.ChatCompletionMessageParam {
    return { role: "system", content };
  }

  static createUserMessage(
    text: string,
    imageBase64?: string
  ): OpenAI.ChatCompletionMessageParam {
    const content: Array<
      OpenAI.ChatCompletionContentPart | OpenAI.ChatCompletionContentPartText | OpenAI.ChatCompletionContentPartImage
    > = [];

    if (imageBase64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${imageBase64}` },
      });
    }

    content.push({ type: "text", text });

    return { role: "user", content };
  }

  static createAssistantMessage(
    content: string
  ): OpenAI.ChatCompletionMessageParam {
    return { role: "assistant", content };
  }

  static removeImagesFromMessage(
    message: OpenAI.ChatCompletionMessageParam
  ): OpenAI.ChatCompletionMessageParam {
    if (Array.isArray(message.content)) {
      message.content = message.content.filter(
        (item): item is OpenAI.ChatCompletionContentPartText =>
          typeof item === "object" && item.type === "text"
      );
    }
    return message;
  }

  static buildScreenInfo(
    currentApp: string,
    extraInfo?: Record<string, unknown>
  ): string {
    const info = { current_app: currentApp, ...extraInfo };
    return JSON.stringify(info);
  }
}
