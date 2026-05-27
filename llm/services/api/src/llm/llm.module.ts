import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { LlmController } from './llm.controller';
import { RequirementService } from './requirement.service';
import { RunnableMemoryService } from './memory/runnable-memory.service';
import { MemoryController } from './memory/memory.controller';
import { FilesystemService } from './filesystem/filesystem.service';
import { FilesystemController } from './filesystem/filesystem.controller';

@Module({
  providers: [
    LlmService,
    RequirementService,
    RunnableMemoryService,
    FilesystemService,
  ],
  controllers: [LlmController, MemoryController, FilesystemController],
  exports: [
    LlmService,
    RequirementService,
    RunnableMemoryService,
    FilesystemService,
  ],
})
export class LlmModule {}
