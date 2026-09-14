import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { migrations } from './migrations';
import { resolveDbSslOptions } from './modules/database/resolve-db-ssl-options.util';
import { ENTITIES } from './modules/database/entities';

const envFile = process.env.ENV_FILE || '.env';
dotenv.config({ path: envFile });

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: resolveDbSslOptions(process.env),
  entities: ENTITIES,
  migrations,
  migrationsTableName: 'typeorm_migrations',
});
