import { Injectable } from '@nestjs/common';
import { HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  RequirementResultSchema,
  type RequirementResult,
} from '@repo/contracts';
import { createChatModel } from './model.factory';
import {
  REQUIREMENT_SYSTEM_PROMPT,
  REQUIREMENT_USER_TEMPLATE,
} from './prompts/requirement.prompt';

@Injectable()
export class RequirementService {
  private model = createChatModel();

  private prompt = ChatPromptTemplate.fromMessages([
    ['system', REQUIREMENT_SYSTEM_PROMPT],
    ['human', REQUIREMENT_USER_TEMPLATE],
  ]);

  // deepseek不支持withStructuredOutput 需要自己写提示词返回结构，并格式化
  async extract(input: string): Promise<RequirementResult> {
    const messages = await this.prompt.formatMessages({ input });
    const result = await this.model.invoke([
      ...messages,
      new HumanMessage(
        `请只返回 JSON，不要包含其他解释，格式如下：
{
  "action": "核心动作（动词+对象）",
  "constraints": ["条件1", "条件2"],
  "entities": ["实体1", "实体2"]
}`
      ),
    ]);

    const raw = result.content.toString();
    const cleaned = raw.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
    const parsed = JSON.parse(cleaned);
    return RequirementResultSchema.parse(parsed);
  }
}
