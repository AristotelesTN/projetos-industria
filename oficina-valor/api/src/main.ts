import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // "*" + credentials quebra o browser (não envia Allow-Origin).
  // true reflete o Origin da request; lista explícita também funciona.
  const rawCors = process.env.CORS_ORIGIN?.trim();
  const origin =
    !rawCors || rawCors === '*'
      ? true
      : rawCors.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Oficina de Valor API em http://localhost:${port}`);
}

bootstrap();
