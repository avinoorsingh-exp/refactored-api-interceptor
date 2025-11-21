// services/orchestrator/src/common/zod-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
import { ZodTypeAny } from 'zod'
import { validationErrorMap } from '@exprealty/shared-domain'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodTypeAny) {}
  transform(value: unknown) {
    const parsed = this.schema.safeParse(value, { errorMap: validationErrorMap })
    if (!parsed.success) {
      // Pass Zod error issues directly for better invalidParams extraction
      throw new BadRequestException({ _zodIssues: parsed.error.issues })
    }
    return parsed.data
  }
}
