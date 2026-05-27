import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const checkConstraintValiditySchema = z.object({
  constraint: z.string(),
});

export const lookupEntityDefinitionSchema = z.object({
  entity: z.string(),
});

export const checkConstraintValidityTool = tool(
  ({ constraint }) => {
    const passed = /必须|至少|不得|不能/.test(constraint);
    return {
      constraint,
      passed,
      reason: passed ? '命中明确约束模式' : '不属于明确约束表达',
    };
  },
  {
    name: 'check_constraint_validity',
    description: '校验一条约束是否属于明确约束表达',
    schema: checkConstraintValiditySchema,
  },
);

export const lookupEntityDefinitionTool = tool(
  ({ entity }) => {
    const map: Record<string, string> = {
      用户: '系统中的账号主体',
      手机号: '用于身份绑定与验证的联系字段',
      密码: '用于登录认证的安全凭证',
    };

    return {
      entity,
      definition: map[entity] ?? '未命中内置定义',
    };
  },
  {
    name: 'lookup_entity_definition',
    description: '查询实体在业务中的定义说明',
    schema: lookupEntityDefinitionSchema,
  },
);
