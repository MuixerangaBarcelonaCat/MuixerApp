import * as fs from 'fs';
import { migrations } from './index';

describe('migrations index', () => {
  it('includes every migration file present in the migrations directory', () => {
    const files = fs
      .readdirSync(__dirname)
      .filter((file) => /^\d+-.+\.ts$/.test(file) && !file.endsWith('.spec.ts'));

    expect(files.length).toBeGreaterThan(0);
    expect(migrations.length).toBe(files.length);

    for (const file of files) {
      const [, timestamp, name] = file.match(/^(\d+)-(.+)\.ts$/) ?? [];
      const expectedClassName = `${name}${timestamp}`;
      const found = migrations.some((migration) => migration.name === expectedClassName);
      expect(found).toBe(true);
    }
  });
});
