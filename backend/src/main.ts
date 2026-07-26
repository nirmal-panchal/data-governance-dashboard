import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All routes are served under /api.
  app.setGlobalPrefix('api');

  // Allow the deployed frontend (and localhost during dev) to call the API.
  const origins = (process.env.FRONTEND_ORIGIN ?? '*')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins.includes('*') ? true : origins });

  // Validate + strip request payloads based on DTO decorators.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
}
void bootstrap();
