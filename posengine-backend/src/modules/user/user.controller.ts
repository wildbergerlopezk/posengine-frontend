import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Put,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a user by ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }

  @Patch(':id/assign-tenant/:tenantId')
  @ApiOperation({ summary: 'Assign a tenant to a user' })
  async assignTenant(@Param('id') userId: string, @Param('tenantId') tenantId: string) {
    return this.userService.assignTenant(userId, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a user by ID' })
  async deactivate(@Param('id') id: string) {
    return this.userService.deactivate(id);
  }
}