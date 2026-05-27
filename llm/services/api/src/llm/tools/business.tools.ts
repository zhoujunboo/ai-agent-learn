import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const workspaceRoot = path.resolve(process.cwd(), 'workspace');

function safePath(relativePath: string): string {
  const targetPath = path.resolve(workspaceRoot, relativePath);
  const insideWorkspace =
    targetPath === workspaceRoot ||
    targetPath.startsWith(`${workspaceRoot}${path.sep}`);

  if (!insideWorkspace) {
    throw new Error('Path is outside workspace');
  }

  return targetPath;
}

const businessIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/, 'ID can only contain letters, numbers, _ and -');

export const queryOrderSchema = z.object({
  orderId: businessIdSchema.describe('订单号，例如 EC20240315001'),
});

export const queryProductSchema = z.object({
  productId: businessIdSchema.describe('商品 ID'),
});

export const readFileSchema = z.object({
  filePath: z
    .string()
    .min(1)
    .describe('workspace 下的相对路径，不要带 workspace/ 前缀'),
});

export const writeFileSchema = z.object({
  filePath: z
    .string()
    .min(1)
    .describe('workspace 下的相对路径，不要带 workspace/ 前缀'),
  content: z.string().describe('要写入文件的内容'),
});

export const queryOrderTool = tool(
  async ({ orderId }) => {
    const filePath = `orders/${orderId}.json`;
    const content = await fs.readFile(safePath(filePath), 'utf8');

    return {
      orderId,
      filePath,
      content,
    };
  },
  {
    name: 'query_order',
    description: '根据订单号读取 workspace/orders/{orderId}.json 中的订单详情',
    schema: queryOrderSchema,
  },
);

export const queryProductTool = tool(
  async ({ productId }) => {
    const filePath = `products/${productId}.json`;
    const content = await fs.readFile(safePath(filePath), 'utf8');

    return {
      productId,
      filePath,
      content,
    };
  },
  {
    name: 'query_product',
    description:
      '根据商品 ID 读取 workspace/products/{productId}.json 中的商品详情',
    schema: queryProductSchema,
  },
);

export const readFileTool = tool(
  async ({ filePath }) => {
    const content = await fs.readFile(safePath(filePath), 'utf8');

    return {
      filePath,
      content,
    };
  },
  {
    name: 'read_file',
    description: '读取 workspace/ 下指定相对路径的文件内容，例如政策、FAQ 等',
    schema: readFileSchema,
  },
);

export const writeFileTool = tool(
  async ({ filePath, content }) => {
    const targetPath = safePath(filePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, 'utf8');

    return {
      filePath,
      bytes: Buffer.byteLength(content, 'utf8'),
      status: 'written',
    };
  },
  {
    name: 'write_file',
    description: '将内容写入 workspace/ 下指定相对路径，例如工单、报告',
    schema: writeFileSchema,
  },
);

export const businessTools = [
  queryOrderTool,
  queryProductTool,
  readFileTool,
  writeFileTool,
];
