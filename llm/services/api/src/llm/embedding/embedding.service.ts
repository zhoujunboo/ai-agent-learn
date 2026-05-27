import { Injectable } from '@nestjs/common';
import { env } from '@huggingface/transformers';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';

// Use HuggingFace mirror (accessible from China) instead of huggingface.co
env.remoteHost = 'https://hf-mirror.com/';

@Injectable()
export class EmbeddingService {
  readonly embeddings = new HuggingFaceTransformersEmbeddings({
    model: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  });

  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(documents);
  }
}
