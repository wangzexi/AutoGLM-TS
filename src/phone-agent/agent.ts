/**
 * Main PhoneAgent class for orchestrating phone automation.
 */

import {
  ActionHandler,
  parseAction,
  doAction,
  finish,
} from "./actions.ts";
import type { ActionResult } from "./actions.ts";
import { getCurrentApp, getScreenshot } from "./adb.ts";
import { SYSTEM_PROMPT } from "./config/index.ts";
import {
	ModelClient,
	createSystemMessage,
	createUserMessage,
	removeImagesFromMessage,
	buildScreenInfo,
	type ModelConfig,
	type ModelResponse,
} from "./model.ts";

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
    };

    this.agentConfig = {
      maxSteps: agentConfig?.maxSteps ?? 100,
      deviceId: agentConfig?.deviceId ?? undefined,
      systemPrompt: agentConfig?.systemPrompt ?? SYSTEM_PROMPT,
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
      this.context.push(createSystemMessage(this.agentConfig.systemPrompt));

      const screenInfo = buildScreenInfo(currentApp);
      const textContent = `${userPrompt}\n\n${screenInfo}`;

      this.context.push(
        createUserMessage(textContent, screenshot.base64Data)
      );
    } else {
      const screenInfo = buildScreenInfo(currentApp);
      const textContent = `** Screen Info **\n\n${screenInfo}`;

      this.context.push(
        createUserMessage(textContent, screenshot.base64Data)
      );
    }

    let response: ModelResponse;

    try {
      console.log("\n" + "=" + "=".repeat(48));
      console.log("💭 思考中:");
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
      console.log("-" + "-".repeat(48));
      console.log("🎯 动作:");
      console.log(JSON.stringify(action, null, 2));
    }

    let result: ActionResult;
    try {
      result = await this.actionHandler.execute(
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

    // Remove image from context to save space
    this.context[this.context.length - 1] = removeImagesFromMessage(
      this.context[this.context.length - 1]
    );

    const finished = action["_metadata"] === "finish" || result.shouldFinish;

    if (finished && this.agentConfig.verbose) {
      console.log("\n" + "🎉 " + "=".repeat(48));
      console.log(
        `✅ 任务完成: ${result.message || action["message"] || "完成"}`
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
