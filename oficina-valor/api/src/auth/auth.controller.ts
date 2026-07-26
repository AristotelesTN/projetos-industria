import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsEmail } from 'class-validator';

class DevLoginDto {
  @IsEmail()
  email!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('dev-login')
  devLogin(@Body() dto: DevLoginDto) {
    return this.auth.loginDev(dto.email);
  }

  @Get('dev-users')
  devUsers() {
    return this.auth.listDevUsers();
  }
}
