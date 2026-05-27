import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createChatModel } from '../model.factory';

const model = createChatModel();
const parser = new StringOutputParser();

export const extractAgent = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是电商客服退货咨询的信息抽取 Agent。',
      '请只输出 JSON，不要输出 Markdown 或解释。',
      '字段必须包含：orderId、productId、requestType、receivedDate、isUnopened。',
      '没有抽取到的字段用 null。isUnopened 必须是 boolean 或 null。',
    ].join('\n'),
  ],
  ['human', '客服对话：{input}'],
])
  .pipe(model)
  .pipe(parser);

export const policyCheckAgent = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是电商售后政策校验 Agent。',
      '根据抽取结果判断是否符合退货与退款条件。',
      '规则：未拆封商品通常支持退货；已拆封商品需要结合质量问题、品类限制和商家政策人工复核；收到货 7 天内通常满足时效要求。',
      '输出必须包含：decision、reason、policyBasis、missingInfo。',
    ].join('\n'),
  ],
  ['human', '抽取结果 JSON：{extraction}'],
])
  .pipe(model)
  .pipe(parser);

export const riskReviewAgent = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是售后风控复核 Agent。',
      '请识别客服对话与抽取结果中的歧义、冲突或缺失信息。',
      '重点关注：订单号、商品标识、收货时间、是否拆封、退货原因、是否质量问题。',
      '输出风险点列表；没有明显风险时说明低风险。',
    ].join('\n'),
  ],
  ['human', '原始对话：{input}\n抽取结果 JSON：{extraction}'],
])
  .pipe(model)
  .pipe(parser);

export const qaAgent = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是 QA 验收条件 Agent。',
      '根据抽取结果、政策校验和风控结果，生成 Given-When-Then 格式的验收条件。',
      '每条验收条件都必须包含 Given、When、Then。',
    ].join('\n'),
  ],
  [
    'human',
    [
      '抽取结果：{extraction}',
      '政策校验：{policyCheck}',
      '风控复核：{riskReview}',
    ].join('\n'),
  ],
])
  .pipe(model)
  .pipe(parser);

export const summaryAgent = ChatPromptTemplate.fromMessages([
  [
    'system',
    [
      '你是电商客服退货判断报告汇总 Agent。',
      '请汇总所有 Agent 输出，生成最终退货判断报告。',
      '报告应包含：用户诉求、关键信息、政策判断、风险点、验收条件、最终建议。',
    ].join('\n'),
  ],
  [
    'human',
    [
      '原始对话：{input}',
      '抽取结果：{extraction}',
      '政策校验：{policyCheck}',
      '风控复核：{riskReview}',
      'QA 验收条件：{qa}',
    ].join('\n'),
  ],
])
  .pipe(model)
  .pipe(parser);
