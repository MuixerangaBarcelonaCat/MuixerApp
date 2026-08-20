import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtPayload, PushSubscriptionStatus, UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PushSubscriptionService } from './push-subscription.service';
import { RegisterSubscriptionDto } from './dto/register-subscription.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';

@ApiTags('me/push-subscriptions')
@ApiBearerAuth()
@Roles(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN)
@Controller('me/push-subscriptions')
export class PushSubscriptionController {
  constructor(private readonly subscriptionService: PushSubscriptionService) {}

  @Post()
  @ApiOperation({ summary: 'Register a push subscription for the current device' })
  async register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterSubscriptionDto): Promise<{ id: string; isActive: boolean }> {
    const sub = await this.subscriptionService.register(user.sub, dto);
    return { id: sub.id, isActive: sub.isActive };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe the current device by endpoint' })
  unsubscribe(@CurrentUser() user: JwtPayload, @Body() dto: UnsubscribeDto): Promise<void> {
    return this.subscriptionService.unsubscribe(user.sub, dto.endpoint);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check whether the current user has any active push subscriptions' })
  getStatus(@CurrentUser() user: JwtPayload): Promise<PushSubscriptionStatus> {
    return this.subscriptionService.getStatus(user.sub);
  }
}
