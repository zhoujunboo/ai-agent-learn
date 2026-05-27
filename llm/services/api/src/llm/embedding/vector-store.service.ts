import { Injectable, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Document } from '@langchain/core/documents';
import { MemoryVectorStore } from '@langchain/classic/vectorstores/memory';
import { EmbeddingService } from './embedding.service';

export type VectorDocumentInput = {
  content: string;
  metadata: object;
};

const workspaceRoot = path.resolve(process.cwd(), 'workspace');
const initialDocumentPaths = [
  'policies/return-policy.md',
  'policies/refund-policy.md',
  'faq/after-sale-faq.md',
];

function safeWorkspacePath(relativePath: string): string {
  const targetPath = path.resolve(workspaceRoot, relativePath);
  const insideWorkspace =
    targetPath === workspaceRoot ||
    targetPath.startsWith(`${workspaceRoot}${path.sep}`);

  if (!insideWorkspace) {
    throw new Error('Path is outside workspace');
  }

  return targetPath;
}

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly vectorStore: MemoryVectorStore;
  private seeded = false;

  constructor(private readonly embeddingService: EmbeddingService) {
    this.vectorStore = new MemoryVectorStore(this.embeddingService.embeddings);
  }

  onModuleInit() {
    void this.seedInitialDocuments().catch((error: unknown) => {
      console.error('Failed to seed initial vector documents', error);
    });
  }

  async addDocuments(docs: VectorDocumentInput[]) {
    const documents = docs.map(
      (doc) =>
        new Document({
          pageContent: doc.content,
          metadata: doc.metadata,
        }),
    );

    await this.vectorStore.addDocuments(documents);

    return {
      added: documents.length,
      total: this.vectorStore.memoryVectors.length,
    };
  }

  async similaritySearch(query: string, topK: number) {
    const limit = Number.isFinite(topK) && topK > 0 ? topK : 3;
    const results = await this.vectorStore.similaritySearchWithScore(
      query,
      limit,
    );

    return results.map(([document, score]) => ({
      content: document.pageContent,
      metadata: document.metadata,
      score,
    }));
  }

  private async seedInitialDocuments() {
    if (this.seeded) {
      return;
    }

    const documents: VectorDocumentInput[] = [];

    for (const filePath of initialDocumentPaths) {
      try {
        const content = await fs.readFile(safeWorkspacePath(filePath), 'utf8');
        documents.push({
          content,
          metadata: {
            source: filePath,
            type: filePath.startsWith('faq/') ? 'faq' : 'policy',
          },
        });
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          continue;
        }

        throw error;
      }
    }

    if (documents.length > 0) {
      await this.addDocuments(documents);
    }

    this.seeded = true;
  }
}
