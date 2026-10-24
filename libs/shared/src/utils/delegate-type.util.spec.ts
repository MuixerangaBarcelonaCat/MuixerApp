import { DelegateType } from '../enums/delegate-type.enum';
import { DELEGATE_TYPE_LABELS } from './delegate-type.util';

describe('DELEGATE_TYPE_LABELS', () => {
  it('té una etiqueta per a cada tipus de relació', () => {
    expect(DELEGATE_TYPE_LABELS).toEqual({
      [DelegateType.PARENT]: 'Pare/mare',
      [DelegateType.GUARDIAN]: 'Tutor/a',
      [DelegateType.OTHER]: 'Altres',
    });
  });
});
