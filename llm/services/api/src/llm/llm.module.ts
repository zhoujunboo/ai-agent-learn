import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { RequirementService } from './requirement.service';
import { RunnableMemoryService } from './memory/runnable-memory.service';
import { MemoryController } from './memory/memory.controller';

@Module({
  providers: [LlmService, RequirementService, RunnableMemoryService],
  controllers: [LlmController, MemoryController],
  exports: [LlmService, RequirementService, RunnableMemoryService],
})
export class LlmModule {}
