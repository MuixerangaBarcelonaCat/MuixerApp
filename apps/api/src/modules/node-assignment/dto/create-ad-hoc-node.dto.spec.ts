import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAdHocNodeDto } from './create-ad-hoc-node.dto';
import { FigureZone, NodeShape } from '@muixer/shared';

const BASE_VALID: object = {
  zone: FigureZone.DECORATION,
  positionType: 'rectangle',
  label: 'Església',
  x: 100,
  y: 200,
  shape: NodeShape.RECTANGLE,
};

async function validateDto(plain: object): Promise<string[]> {
  const dto = plainToInstance(CreateAdHocNodeDto, plain);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CreateAdHocNodeDto — label constraints', () => {
  it('accepts a label up to 500 characters', async () => {
    const label = 'A'.repeat(500);
    const errors = await validateDto({ ...BASE_VALID, label });
    expect(errors).toHaveLength(0);
  });

  it('rejects a label longer than 500 characters', async () => {
    const label = 'A'.repeat(501);
    const errors = await validateDto({ ...BASE_VALID, label });
    expect(errors.some((e) => e.includes('500'))).toBe(true);
  });

  it('accepts a label with internal newlines', async () => {
    const label = 'Primera línia\nSegona línia';
    const errors = await validateDto({ ...BASE_VALID, label });
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty label after trim', async () => {
    const errors = await validateDto({ ...BASE_VALID, label: '   ' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
