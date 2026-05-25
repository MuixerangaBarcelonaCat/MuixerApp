import { PartialType } from '@nestjs/swagger';
import { CreateReferenceElementDto } from './create-reference-element.dto';

export class UpdateReferenceElementDto extends PartialType(CreateReferenceElementDto) {}
