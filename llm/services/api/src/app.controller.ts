import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { APP_NAME } from '@repo/contracts';
import { RequirementService } from './llm/requirement.service';



  @Controller()
  export class AppController {
    constructor(private readonly requirementService: RequirementService) {}

    @Post('/requirement/extract')
    async extract(@Body() body: { input: string }) {
      return this.requirementService.extract(body.input);
    }
  }