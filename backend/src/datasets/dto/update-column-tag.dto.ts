import { IsEnum, IsOptional } from 'class-validator';
import { SensitivityTag } from '../../generated/prisma/enums';

export class UpdateColumnTagDto {
  /**
   * The tag to apply as a manual override. Omit or send null to clear the
   * override and fall back to the auto-detected tag.
   */
  @IsOptional()
  @IsEnum(SensitivityTag)
  manualTag?: SensitivityTag | null;
}
