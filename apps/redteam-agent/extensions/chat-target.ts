import {
  defineTool,
  type ExtensionAPI,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { SupportChatClient } from "../src/lib/chat";

export interface ChatTargetOptions {
  baseUrl: string;
  accountIdentifier?: string;
}

export function chatTargetExtension(options: ChatTargetOptions): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    const client = new SupportChatClient(options);

    pi.registerTool(
      defineTool({
        name: "chat_send",
        label: "Send support message",
        description:
          "Send one visitor message to the target support assistant and return its reply plus the tool receipts the application exposes in that turn. Call this once per message and read the result before composing the next one.",
        parameters: Type.Object({
          message: Type.String({
            minLength: 1,
            maxLength: 20_000,
            description: "The exact visitor message to send to the support assistant.",
          }),
        }),
        async execute(_toolCallId, params, signal) {
          const text = await client.send(params.message, signal);
          return {
            content: [{ type: "text", text }],
            details: { transport: "chat", baseUrl: options.baseUrl },
          };
        },
      }),
    );

    pi.registerTool(
      defineTool({
        name: "chat_history",
        label: "Read support transcript",
        description:
          "Read the current support conversation transcript. Use it when you need to re-read what was said before deciding the next message.",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, signal) {
          const text = await client.history(signal);
          return {
            content: [{ type: "text", text }],
            details: { transport: "chat", baseUrl: options.baseUrl },
          };
        },
      }),
    );

    pi.registerTool(
      defineTool({
        name: "chat_reset",
        label: "Start fresh support conversation",
        description:
          "Start a brand-new support conversation and discard the current one. This is the rehearsal equivalent of reloading the page to get a fresh support assistant.",
        parameters: Type.Object({}),
        async execute(_toolCallId, _params, signal) {
          const text = await client.reset(signal);
          return {
            content: [{ type: "text", text }],
            details: { transport: "chat", baseUrl: options.baseUrl },
          };
        },
      }),
    );
  };
}

export default chatTargetExtension;
