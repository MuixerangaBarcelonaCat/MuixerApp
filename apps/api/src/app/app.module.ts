import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '../modules/database/database.module';
import { PositionModule } from '../modules/position/position.module';
import { UserModule } from '../modules/user/user.module';
import { PersonModule } from '../modules/person/person.module';

@Module({
  imports: [DatabaseModule, PositionModule, UserModule, PersonModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
