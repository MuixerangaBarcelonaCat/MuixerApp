import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SeasonMutationQueryDto } from './season-mutation-query.dto';

describe('SeasonMutationQueryDto', () => {
  const parse = (query: Record<string, unknown>) => plainToInstance(SeasonMutationQueryDto, query);

  it.each([
    ['true', true],
    ['false', false],
  ])('parses allowUncovered=%s', async (raw, expected) => {
    const dto = parse({ allowUncovered: raw });
    expect(dto.allowUncovered).toBe(expected);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('leaves allowUncovered undefined when absent', async () => {
    const dto = parse({});
    expect(dto.allowUncovered).toBeUndefined();
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-boolean value', async () => {
    expect(await validate(parse({ allowUncovered: 'yes' }))).not.toHaveLength(0);
  });
});
