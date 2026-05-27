import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { RequirementService } from './requirement.service';
import { RunnableMemoryService } from './memory/runnable-memory.service';
import { MemoryController } from './memory/memory.controller';
import { FilesystemService } from './filesystem/filesystem.service';
import { FilesystemController } from './filesystem/filesystem.controller';
import { EmbeddingService } from './embedding/embedding.service';
import { VectorStoreService } from './embedding/vector-store.service';
import { EmbeddingController } from './embedding/embedding.controller';
import { OrchestratorService } from './agents/orchestrator.service';
import { AgentsController } from './agents/agents.controller';

@Module({
  providers: [
    LlmService,
    RequirementService,
    RunnableMemoryService,
    FilesystemService,
    EmbeddingService,
    VectorStoreService,
    OrchestratorService,
  ],
  controllers: [
    LlmController,
    MemoryController,
    FilesystemController,
    EmbeddingController,
    AgentsController,
  ],
  exports: [
    LlmService,
    RequirementService,
    RunnableMemoryService,
    FilesystemService,
    EmbeddingService,
    VectorStoreService,
    OrchestratorService,
  ],
})
export class LlmModule {}
