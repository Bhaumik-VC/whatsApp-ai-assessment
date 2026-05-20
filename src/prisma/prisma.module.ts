import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global makes PrismaService available everywhere without importing this module explicitly
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
