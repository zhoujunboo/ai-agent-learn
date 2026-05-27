import { Injectable } from '@nestjs/common';
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { createChatModel } from '../model.factory';
import {
  businessTools,
  queryOrderSchema,
  queryOrderTool,
  queryProductSchema,
  queryProductTool,
  readFileSchema,
  readFileTool,
  writeFileSchema,
  writeFileTool,
} from '../tools/business.tools';

@Injectable()
export class FilesystemService {
  private model = createChatModel();

  async fileChat(input: string) {
    const modelWithTools = this.model.bindTools(businessTools);

    const messages: BaseMessage[] = [
      new SystemMessage(
        [
          '你是电商客服系统的文件与业务查询助手。',
          '你可以按需查询订单、查询商品、读取政策/FAQ 文件，也可以把工单或分析报告写入 workspace。',
          '所有文件路径都必须使用 workspace 内的相对路径，不要带 workspace/ 前缀。',
          '当用户要求写入文件时，先组织清楚结论，再调用 write_file。',
        ].join('\n'),
      ),
      new HumanMessage(input),
    ];

    const firstResponse = await modelWithTools.invoke(messages);
    messages.push(firstResponse);

    for (const toolCall of firstResponse.tool_calls ?? []) {
      if (toolCall.id === undefined) {
        continue;
      }

      let toolResult: unknown;

      switch (toolCall.name) {
        case queryOrderTool.name:
          toolResult = await queryOrderTool.invoke(
            queryOrderSchema.parse(toolCall.args),
          );
          break;
        case queryProductTool.name:
          toolResult = await queryProductTool.invoke(
            queryProductSchema.parse(toolCall.args),
          );
          break;
        case readFileTool.name:
          toolResult = await readFileTool.invoke(
            readFileSchema.parse(toolCall.args),
          );
          break;
        case writeFileTool.name:
          toolResult = await writeFileTool.invoke(
            writeFileSchema.parse(toolCall.args),
          );
          break;
        default:
          continue;
      }

      messages.push(
        new ToolMessage({
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        }),
      );
    }

    const finalResponse = await modelWithTools.invoke(messages);

    return {
      result: finalResponse.content,
      toolCalls: firstResponse.tool_calls ?? [],
    };
  }
}
