import { Injectable } from '@nestjs/common';
import {
  extractAgent,
  policyCheckAgent,
  qaAgent,
  riskReviewAgent,
  summaryAgent,
} from './sub-agents';

type AgentStep = {
  agent: string;
  output: string;
};

type ExtractedReturnRequest = {
  orderId?: string | null;
  productId?: string | null;
  requestType?: string | null;
  receivedDate?: string | null;
  isUnopened?: boolean | null;
};

@Injectable()
export class OrchestratorService {
  async orchestrate(input: string) {
    const usedAgents: string[] = [];
    const steps: AgentStep[] = [];

    try {
      const extraction = await extractAgent.invoke({ input });
      usedAgents.push('extractAgent');
      steps.push({ agent: 'extractAgent', output: extraction });

      const parsedExtraction = this.parseExtraction(extraction);
      const clarificationQuestions =
        this.getClarificationQuestions(parsedExtraction);

      if (clarificationQuestions.length > 0) {
        return {
          mode: 'clarification',
          clarificationQuestions,
          usedAgents,
          fallback: null,
          steps,
          report: null,
        };
      }

      const [policyCheck, riskReview] = await Promise.all([
        policyCheckAgent.invoke({ extraction }),
        riskReviewAgent.invoke({ input, extraction }),
      ]);

      usedAgents.push('policyCheckAgent', 'riskReviewAgent');
      steps.push(
        { agent: 'policyCheckAgent', output: policyCheck },
        { agent: 'riskReviewAgent', output: riskReview },
      );

      const qa = await qaAgent.invoke({
        extraction,
        policyCheck,
        riskReview,
      });

      usedAgents.push('qaAgent');
      steps.push({ agent: 'qaAgent', output: qa });

      const report = await summaryAgent.invoke({
        input,
        extraction,
        policyCheck,
        riskReview,
        qa,
      });

      usedAgents.push('summaryAgent');
      steps.push({ agent: 'summaryAgent', output: report });

      return {
        mode: 'fixed_workflow',
        clarificationQuestions: [],
        usedAgents,
        fallback: null,
        steps,
        report,
      };
    } catch (error) {
      return {
        mode: 'fallback',
        clarificationQuestions: [],
        usedAgents,
        fallback: 'manual_review',
        steps,
        report: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private parseExtraction(output: string): ExtractedReturnRequest {
    const cleaned = output
      .replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1')
      .trim();

    return JSON.parse(cleaned) as ExtractedReturnRequest;
  }

  private getClarificationQuestions(extraction: ExtractedReturnRequest) {
    const questions: string[] = [];

    if (!extraction.orderId) {
      questions.push('请提供订单号。');
    }

    if (!extraction.requestType) {
      questions.push('请确认本次诉求是退货、退款、换货还是其他售后请求。');
    }

    if (!extraction.receivedDate) {
      questions.push('请提供实际收货日期或说明是今天、昨天等相对时间。');
    }

    if (extraction.isUnopened === null || extraction.isUnopened === undefined) {
      questions.push('请确认商品是否未拆封。');
    }

    return questions;
  }
}
