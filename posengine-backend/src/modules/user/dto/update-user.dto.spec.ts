import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  it.each(['password', 'tenantId', 'role', 'active'])(
    'rejects administrative property %s on the generic update endpoint',
    async (property) => {
      const dto = Object.assign(new UpdateUserDto(), {
        name: 'Valid name',
        [property]: 'attempted-change',
      });

      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors.some((error) => error.property === property)).toBe(true);
    },
  );
});
