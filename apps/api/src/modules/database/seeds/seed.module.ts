import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from '../../position/position.entity';
import { Person } from '../../person/person.entity';
import { User } from '../../user/user.entity';
import { PositionModule } from '../../position/position.module';
import { PersonModule } from '../../person/person.module';
import { UserModule } from '../../user/user.module';
import { SeedCommand } from './seed.command';

@Module({
  imports: [
    TypeOrmModule.forFeature([Position, Person, User]),
    PositionModule,
    PersonModule,
    UserModule,
  ],
  providers: [SeedCommand],
})
export class SeedModule {}
