import { Injectable } from '@nestjs/common';
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts';
import {
  RunnablePassthrough,
  RunnableWithMessageHistory,
} from '@langchain/core/runnables';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { trimMessages, type BaseMessage } from '@langchain/core/messages';
import { createChatModel } from '../model.factory';

/**
 * 带记忆功能的对话 Service
 *
 * 核心思路：
 *   每个用户用一个 sessionId 区分，对话历史存在内存 Map 里。
 *   每次调用时，LangChain 会自动把历史消息拼进 prompt，让模型"记得"之前说过什么。
 *
 * 两种模式：
 *   - chat()：把全部历史都塞给模型（对话短时够用）
 *   - chatTrim()：先裁掉太老的消息再塞（对话很长时防止超出 token 上限）
 */
@Injectable()
export class RunnableMemoryService {
  // 用 Map 存所有会话的聊天历史，key 是 sessionId，value 是该会话的消息列表
  // InMemoryChatMessageHistory 是 LangChain 提供的内存版历史记录对象
  private store = new Map<string, InMemoryChatMessageHistory>();

  // 创建 LLM 模型实例（具体用哪个模型由 model.factory 里的配置决定）
  private model = createChatModel();

  /**
   * 提示词模板（Prompt Template）
   *
   * ChatPromptTemplate.fromMessages 接收一个消息数组，按顺序拼成最终发给模型的 prompt：
   *   1. ['system', '...']  → 系统提示，告诉模型它的角色（这里是电商客服）
   *   2. MessagesPlaceholder('history') → 占位符，运行时会被替换成真实的历史消息列表
   *   3. ['human', '{input}'] → 用户这一轮的输入，{input} 是变量，调用时传入
   */
  private prompt = ChatPromptTemplate.fromMessages([
    ['system', '你是一名电商客服助手，请结合历史对话理解用户诉求并给出回答。'],
    new MessagesPlaceholder('history'),
    ['human', '{input}'],
  ]);

  /**
   * 基础链（Chain）
   *
   * LangChain 里"链"就是把多个步骤用 .pipe() 串起来，数据从左往右流：
   *   prompt（拼好的消息） → model（调用 LLM 得到回复）
   */
  private chain = this.prompt.pipe(this.model);

  /**
   * 消息裁剪器（trimMessages）
   *
   * 当历史消息太多时，直接全部塞给模型会超出 token 限制，所以需要裁剪。
   *
   * 参数说明：
   *   - maxTokens: 2000   → 最多保留 2000 个"token"（这里用消息条数近似代替）
   *   - strategy: 'last'  → 裁剪策略：保留最新的消息，丢掉最老的
   *   - tokenCounter       → 自定义计数函数，这里直接用消息条数当 token 数（省去引入专业 tokenizer）
   *   - includeSystem: true → 保留系统消息（不裁掉 system prompt）
   *   - allowPartial: false → 不允许截断单条消息（要么保留完整消息，要么不要）
   *   - startOn: 'human'  → 裁剪后第一条保留的消息必须是用户消息（保证对话结构合法）
   */
  private trimmer = trimMessages({
    maxTokens: 2000,
    strategy: 'last',
    tokenCounter: (msgs) => msgs.length,
    includeSystem: true,
    allowPartial: false,
    startOn: 'human',
  });

  /**
   * 带裁剪的链（trimChain）
   *
   * RunnablePassthrough.assign 的作用：在数据流过时，对其中某个字段做处理，其他字段原样透传。
   * 这里把 input 数据里的 history 字段先经过 trimmer 裁剪，再传给 prompt 和 model。
   *
   * 数据流：
   *   原始输入 { input, history }
   *     → assign 裁剪 history → { input, history(裁剪后) }
   *     → prompt（拼 prompt）
   *     → model（调用 LLM）
   */
  private trimChain = RunnablePassthrough.assign({
    // history 由 RunnableWithMessageHistory 在运行时自动注入，类型标为可选避免编译报错
    history: (input: { input: string; history?: BaseMessage[] }) =>
      this.trimmer.invoke(input.history ?? []),
  })
    .pipe(this.prompt)
    .pipe(this.model);

  /**
   * 根据 sessionId 获取（或创建）该会话的历史记录对象
   * 首次访问某个 sessionId 时自动初始化一个空的历史记录
   */
  private getSessionHistory = (sessionId: string) => {
    if (!this.store.has(sessionId)) {
      this.store.set(sessionId, new InMemoryChatMessageHistory());
    }
    return this.store.get(sessionId)!;
  };

  /**
   * 标准版带记忆的链（全量历史）
   *
   * RunnableWithMessageHistory 是 LangChain 提供的"自动管理历史"包装器：
   *   - 每次 invoke 前，它自动调用 getMessageHistory 取出历史，注入到 historyMessagesKey 指定的字段
   *   - invoke 结束后，自动把这轮的用户消息和 AI 回复追加到历史里
   *   - inputMessagesKey: 'input'   → 告诉它哪个字段是用户这轮的输入
   *   - historyMessagesKey: 'history' → 告诉它把历史注入到哪个字段（对应 prompt 里的占位符名）
   */
  private withHistory = new RunnableWithMessageHistory({
    runnable: this.chain,
    getMessageHistory: this.getSessionHistory,
    inputMessagesKey: 'input',
    historyMessagesKey: 'history',
  });

  /**
   * 带裁剪的带记忆链（适合长对话）
   * 和 withHistory 一样，只是底层 runnable 换成了先裁剪历史再处理的 trimChain
   */
  private withHistoryTrim = new RunnableWithMessageHistory({
    runnable: this.trimChain,
    getMessageHistory: this.getSessionHistory,
    inputMessagesKey: 'input',
    historyMessagesKey: 'history',
  });

  /**
   * 标准对话（全量历史版）
   * configurable.sessionId 告诉 RunnableWithMessageHistory 去哪个会话取/存历史
   */
  async chat(sessionId: string, input: string) {
    const response = await this.withHistory.invoke(
      { input },
      { configurable: { sessionId } },
    );
    return { response: response.content };
  }

  /**
   * 对话（带历史裁剪版）
   * 适合对话轮数很多的场景，防止历史太长撑爆 token
   */
  async chatTrim(sessionId: string, input: string) {
    const response = await this.withHistoryTrim.invoke(
      { input },
      { configurable: { sessionId } },
    );
    return { response: response.content };
  }

  /** 获取某个会话的全部历史消息（用于调试或展示聊天记录） */
  async getHistory(sessionId: string) {
    return this.getSessionHistory(sessionId).getMessages();
  }

  /** 手动向历史里追加一组消息（测试或数据回放时用） */
  async appendMessage(sessionId: string, human: string, ai: string) {
    const history = this.getSessionHistory(sessionId);
    await history.addUserMessage(human);
    await history.addAIMessage(ai);
  }

  /** 清空某个会话的历史记录（相当于"开始新对话"） */
  clearSession(sessionId: string) {
    this.store.delete(sessionId);
  }
}
