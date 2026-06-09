import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

const envFile = process.env.ENV_FILE || '.env';
dotenv.config({ path: envFile });

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [join(__dirname, 'modules/**/*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
});
