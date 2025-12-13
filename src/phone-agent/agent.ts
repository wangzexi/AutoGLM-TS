/**
 * Main PhoneAgent class for orchestrating phone automation.
 */

import {
  ActionHandler,
  parseAction,
  doAction,
  finish,
} from "./actions/handler.ts";
import type { ActionResult } from "./actions/handler.ts";
import { getCurrentApp, getScreenshot } from "./adb/index.ts";
import { getMessage, getSystemPrompt } from "./config/index.ts";
import { ModelClient, MessageBuilder } from "./model/client.ts";
import type { ModelConfig, ModelResponse } from "./model/client.ts";

export interface AgentConfig {
  maxSteps?: number;
  deviceId?: string;
  systemPrompt?: string;
  verbose?: boolean;
}

export interface StepResult {
  success: boolean;
  finished: boolean;
  action?: Record<string, unknown>;
  thinking: string;
  message?: string;
}

export class PhoneAgent {
  private modelConfig: Required<ModelConfig>;
  private agentConfig: Required<AgentConfig>;
  private modelClient: ModelClient;
  private actionHandler: ActionHandler;
  private context: Array<Record<string, unknown>>;
  private stepCount: number;

  constructor(
    modelConfig?: ModelConfig,
    agentConfig?: AgentConfig,
    confirmationCallback?: (message: string) => boolean,
    takeoverCallback?: (message: string) => void
  ) {
    this.modelConfig = {
      baseUrl: modelConfig?.baseUrl ?? "http://localhost:8000/v1",
      apiKey: modelConfig?.apiKey ?? "EMPTY",
      modelName: modelConfig?.modelName ?? "autoglm-phone-9b",
      maxTokens: modelConfig?.maxTokens ?? 3000,
      temperature: modelConfig?.temperature ?? 0,
      topP: modelConfig?.topP ?? 0.85,
      frequencyPenalty: modelConfig?.frequencyPenalty ?? 0.2,
      extraBody: modelConfig?.extraBody ?? {},
    };

    this.agentConfig = {
      maxSteps: agentConfig?.maxSteps ?? 100,
      deviceId: agentConfig?.deviceId,
      systemPrompt: agentConfig?.systemPrompt ?? getSystemPrompt(),
      verbose: agentConfig?.verbose ?? true,
    };

    this.modelClient = new ModelClient(this.modelConfig);
    this.actionHandler = new ActionHandler(
      this.agentConfig.deviceId,
      confirmationCallback,
      takeoverCallback
    );

    this.context = [];
    this.stepCount = 0;
  }

  async run(task: string): Promise<string> {
    this.context = [];
    this.stepCount = 0;

    const result = await this.executeStep(task, true);

    if (result.finished) {
      return result.message || "Task completed";
    }

    while (this.stepCount < this.agentConfig.maxSteps) {
      const result = await this.executeStep(undefined, false);

      if (result.finished) {
        return result.message || "Task completed";
      }
    }

    return "Max steps reached";
  }

  async step(task?: string): Promise<StepResult> {
    const isFirst = this.context.length === 0;

    if (isFirst && !task) {
      throw new Error("Task is required for the first step");
    }

    return this.executeStep(task, isFirst);
  }

  reset(): void {
    this.context = [];
    this.stepCount = 0;
  }

  private async executeStep(userPrompt?: string, isFirst: boolean = false): Promise<StepResult> {
    this.stepCount++;

    const screenshot = await getScreenshot(this.agentConfig.deviceId);
    const currentApp = getCurrentApp(this.agentConfig.deviceId);

    if (isFirst) {
      this.context = [];
      this.context.push(MessageBuilder.createSystemMessage(this.agentConfig.systemPrompt));

      const screenInfo = MessageBuilder.buildScreenInfo(currentApp);
      const textContent = `${userPrompt}\n\n${screenInfo}`;

      this.context.push(
        MessageBuilder.createUserMessage(textContent, screenshot.base64Data)
      );
    } else {
      const screenInfo = MessageBuilder.buildScreenInfo(currentApp);
      const textContent = `** Screen Info **\n\n${screenInfo}`;

      this.context.push(
        MessageBuilder.createUserMessage(textContent, screenshot.base64Data)
      );

      const maxMessages = 6;
      if (this.context.length > maxMessages) {
        this.context.splice(1, this.context.length - maxMessages);
      }
    }

    let response: ModelResponse;

    try {
      const msgs = getMessage("thinking");
      console.log("\n" + "=" + "=".repeat(48));
      console.log(`💭 ${msgs}:`);
      console.log("-" + "-".repeat(48));

      response = await this.modelClient.request(this.context as any);
    } catch (e: unknown) {
      if (this.agentConfig.verbose) {
        console.error(e);
      }
      return {
        success: false,
        finished: true,
        action: undefined,
        thinking: "",
        message: `Model error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    let action: Record<string, unknown>;
    try {
      action = parseAction(response.action);
    } catch (e: unknown) {
      if (this.agentConfig.verbose) {
        console.error(e);
      }
      action = finish(response.action);
    }

    if (this.agentConfig.verbose) {
      const msgs = getMessage("action");
      console.log("-" + "-".repeat(48));
      console.log(`🎯 ${msgs}:`);
      console.log(JSON.stringify(action, null, 2));
    }

    let result: ActionResult;
    try {
      result = this.actionHandler.execute(
        action,
        screenshot.width,
        screenshot.height
      );
    } catch (e: unknown) {
      return {
        success: false,
        finished: true,
        action,
        thinking: response.thinking,
        message: `Action execution error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    const finished = action["_metadata"] === "finish" || result.shouldFinish;

    if (finished && this.agentConfig.verbose) {
      const msgs = getMessage("task_completed");
      console.log("\n" + "🎉 " + "=".repeat(48));
      console.log(
        `✅ ${msgs}: ${result.message || action["message"] || getMessage("done")}`
      );
      console.log("=" + "=".repeat(48) + "\n");
    }

    return {
      success: result.success,
      finished,
      action,
      thinking: response.thinking,
      message: result.message || (action["message"] as string | undefined),
    };
  }

  getContext(): Array<Record<string, unknown>> {
    return [...this.context];
  }

  getStepCount(): number {
    return this.stepCount;
  }
}
