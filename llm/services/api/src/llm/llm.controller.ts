import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LlmService } from './llm.service';

@Controller('api/langchain')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

    @Post('invoke')
    async invoke(@Body() body: { input: string }) {
        const result = await this.llmService.invokeDemo(body.input);
        return { result };
    }

}


