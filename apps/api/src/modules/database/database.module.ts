import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// typeorm requires `pg` dynamically (driver lookup by the `type: 'postgres'` string above),
// so Nx's static dependency scan won't see it and won't pin it in the generated production
// package.json unless it's imported directly somewhere in the bundle.
import 'pg';
import { ENTITIES } from './entities';
import { migrations } from '../../migrations';
import { resolveDbSslOptions } from './resolve-db-ssl-options.util';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const isDevelopment = process.env.NODE_ENV !== 'production';

        return {
          type: 'postgres',
          url: process.env.DATABASE_URL,
          ssl: resolveDbSslOptions(process.env),
          entities: ENTITIES,
          synchronize: false,
          migrationsRun: isDevelopment,
          migrations,
          migrationsTableName: 'typeorm_migrations',
          logging: isDevelopment,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
