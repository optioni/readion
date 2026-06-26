import { Injectable } from '@nestjs/common'

@Injectable()
export class MockExamWorkerGenerationService {
  async generateAndStamp(_attemptId: string): Promise<void> {
    throw new Error('Not implemented')
  }
}
