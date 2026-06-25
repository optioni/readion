import { Injectable } from '@nestjs/common'
import { LlmService } from '../../llm/llm.service'

@Injectable()
export class EmbedderService {
  private static readonly BATCH_SIZE = 100

  constructor(private readonly llm: LlmService) {}

  async embedChunks(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    return this.llm.embedTexts(texts, EmbedderService.BATCH_SIZE)
  }
}
