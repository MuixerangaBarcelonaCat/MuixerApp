import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { migrations } from './migrations';
import { resolveDbSslOptions } from './modules/database/resolve-db-ssl-options.util';

const envFile = process.env.ENV_FILE || '.env';
dotenv.config({ path: envFile });

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: resolveDbSslOptions(process.env),
  entities: [join(__dirname, 'modules/**/*.entity.{ts,js}')],
  migrations,
  migrationsTableName: 'typeorm_migrations',
});
