import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { RunnableMemoryService } from './runnable-memory.service';

@Controller('api/memory')
export class MemoryController {
  constructor(private readonly memoryService: RunnableMemoryService) {}

  @Post('chat')
  async chat(@Body() body: { sessionId: string; input: string }) {
    return this.memoryService.chat(body.sessionId, body.input);
  }

  @Get('history')
  async history(@Query('sessionId') sessionId: string) {
    const messages = await this.memoryService.getHistory(sessionId);
    return {
      sessionId,
      messages: messages.map((m) => ({
        role: m._getType(),
        content: m.content,
      })),
    };
  }

  @Delete('clear')
  clear(@Query('sessionId') sessionId: string) {
    this.memoryService.clearSession(sessionId);
    return { sessionId, cleared: true };
  }
}
