import { Injectable } from '@nestjs/common';
import { createChatModel } from './model.factory';
import { requirementPrompt } from './requirement.prompt-builder';
import { requirementChain } from './requirement.chain';
import {
  checkConstraintValidityTool,
  lookupEntityDefinitionTool,
} from './tools/basic.tools';
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';

@Injectable()
export class LlmService {
  private model = createChatModel();


  async invokeDemo(input: string): Promise<string> {
    const systemMessage = new SystemMessage('你是一名需求结构化抽取助手');
    const humanMessage = new HumanMessage(
      `请从下面文本中抽取 action、constraints、entities：\n${input}`
    );
    const messages: BaseMessage[] = [systemMessage, humanMessage];
    const response = await this.model.invoke(messages);
    return response.content.toString();
  }


  async streamDemo(input: string) {
    return this.model.stream([
      new SystemMessage('你是一名需求结构化抽取助手'),
      new HumanMessage(`请逐步分析并输出结构化抽取结果：\n${input}`),
    ]);
  }

  async batchDemo(inputs: string[]) {
    const messageGroups = inputs.map((input) => [
      new SystemMessage('你是一名需求结构化抽取助手'),
      new HumanMessage(`请抽取 action、constraints、entities：\n${input}`),
    ]);

    const responses = await this.model.batch(messageGroups);
    return responses.map((item) => item.content.toString());
  }

  // -----------------------------------------
  async promptPreview(input: string) {
    const promptValue = await requirementPrompt.invoke({ input });
    return { 
      rendered: promptValue.toString() 
    };
  }

  async promptToModel(input: string) {
    const messages = await requirementPrompt.formatMessages({ input });
    const response = await this.model.invoke(messages);
    return { result: response.content };
  }

  // -----------------------------------------

  async chainInvoke(input: string) {
    const result = await requirementChain.invoke({ input });
    return { result };
  }

  async chainStream(input: string) {
    return requirementChain.stream({ input });
  }


  async chainBatch(inputs: string[]) {
    const results = await requirementChain.batch(
      inputs.map((input) => ({ input }))
    );
    return results.map((result, i) => ({ index: i + 1, result }));
  }



  async toolBindDemo(input: string) {
    const modelWithTools = this.model.bindTools([
        checkConstraintValidityTool,
        lookupEntityDefinitionTool,
      ]);

      const response = await modelWithTools.invoke([
        new SystemMessage('你可以按需要调用工具来校验约束和查询实体定义。'),
        new HumanMessage(`请分析下面需求：${input}`),
      ]);

      return {
        result: response.content.toString(),
        toolCalls: response.tool_calls as ToolCall[],
      };
  }

  // 执行工具

  // 工具调用循环：先让 LLM 抽取需求要素，再逐个调用工具校验，最后汇总结果
  async toolLoopDemo(input: string) {
    // 注册可用的工具列表（约束校验 + 实体定义查询）
    const tools = [checkConstraintValidityTool, lookupEntityDefinitionTool];
    // 构建工具名 → 工具对象的映射表，便于后续按名称查找
    const toolMap = Object.fromEntries(tools.map((t) => [t.name, t]));
    // 将工具绑定到模型实例上，使其能发起 tool_calls
    const modelWithTools = this.model.bindTools(tools);

    // 构建初始消息列表：系统提示 + 用户输入
    const messages: BaseMessage[] = [
      new SystemMessage('你可以调用工具来帮助完成需求抽取后的校验。'),
      new HumanMessage(
        `先抽取 action、constraints、entities，再按需要调用工具：${input}`
      ),
    ];

    // 第一次调用：LLM 抽取需求并决定需要调用哪些工具
    const firstResponse = await modelWithTools.invoke(messages);
    messages.push(firstResponse);

    // 遍历 LLM 返回的每个工具调用，执行并将结果写回消息列表
    for (const toolCall of firstResponse.tool_calls ?? []) {
      const targetTool = toolMap[toolCall.name];
      // 忽略未注册的工具调用，防止执行未知工具
      if (!targetTool) continue;
      const toolResult = await targetTool.invoke(toolCall.args);
      messages.push(
        new ToolMessage({
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        })
      );
    }

    // 第二次调用：LLM 综合工具返回结果，给出最终答案
    const finalResponse = await modelWithTools.invoke(messages);
    return { result: finalResponse.content };
  }


}

