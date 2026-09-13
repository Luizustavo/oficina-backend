// Estes dois imports precisam vir antes de qualquer outro: as instrumentações
// automáticas do OpenTelemetry substituem métodos de http, express, pg e
// nestjs, e só conseguem fazer isso se rodarem antes desses módulos serem
// carregados. Mover qualquer import para cima daqui desliga a telemetria em
// silêncio — sem erro, só sem dados.
import 'dotenv/config';
import { startTracing } from './infrastructure/observability/tracing';

startTracing();

import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpExceptionFilter } from './infrastructure/presentation/filters/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  // bufferLogs guarda o que for logado durante o boot para reemitir pelo
  // logger definitivo, em vez de perder essas linhas no console cru.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Troca o logger do Nest pelo Pino. Os casos de uso continuam injetando
  // `Logger` de `@nestjs/common` — ele delega para este, então a convenção
  // do projeto segue valendo e a saída passa a ser JSON estruturado.
  app.useLogger(app.get(Logger));
  app.flushLogs();

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Oficina Backend API')
    .setDescription(
      'Mechanical Workshop Management System - Tech Challenge SOAT Fase 1',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  app.get(Logger).log(`Aplicação ouvindo na porta ${port}`);
}
void bootstrap();
