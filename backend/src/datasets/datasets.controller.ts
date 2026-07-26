import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DatasetsService } from './datasets.service';
import { UpdateColumnTagDto } from './dto/update-column-tag.dto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

@Controller('datasets')
export class DatasetsController {
  constructor(private readonly datasets: DatasetsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Attach a CSV or Excel file in the "file" field.',
      );
    }
    return this.datasets.createFromUpload(file);
  }

  @Get()
  findAll() {
    return this.datasets.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.datasets.findOne(id);
  }

  @Patch(':id/columns/:columnId')
  updateColumnTag(
    @Param('id') id: string,
    @Param('columnId') columnId: string,
    @Body() dto: UpdateColumnTagDto,
  ) {
    return this.datasets.updateColumnTag(id, columnId, dto.manualTag);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.datasets.remove(id);
  }
}
