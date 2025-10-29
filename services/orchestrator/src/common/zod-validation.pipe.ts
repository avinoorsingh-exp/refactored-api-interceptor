// services/orchestrator/src/common/zod-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
import { ZodTypeAny } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodTypeAny) {}
  transform(value: unknown) {
    const parsed = this.schema.safeParse(value)
    if (!parsed.success) throw new BadRequestException(parsed.error.format())
    return parsed.data
  }
}
