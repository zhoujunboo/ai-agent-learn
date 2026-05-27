import { Body, Controller, Post } from '@nestjs/common';
import {
  VectorDocumentInput,
  VectorStoreService,
} from './vector-store.service';

@Controller('api/embedding')
export class EmbeddingController {
  constructor(private readonly vectorStoreService: VectorStoreService) {}

  @Post('store')
  async store(@Body() body: { documents: VectorDocumentInput[] }) {
    return this.vectorStoreService.addDocuments(body.documents);
  }

  @Post('search')
  async search(@Body() body: { query: string; topK?: number }) {
    return this.vectorStoreService.similaritySearch(body.query, body.topK ?? 3);
  }
}
