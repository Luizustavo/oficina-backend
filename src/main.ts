// Estes dois imports precisam vir antes de qualquer outro: as instrumentações
// automáticas do OpenTelemetry substituem métodos de http, express, pg e
// nestjs, e só conseguem fazer isso se rodarem antes desses módulos serem
// carregados. Mover qualquer import para cima daqui desliga a telemetria em
// silêncio — sem erro, só sem dados.
import 'dotenv/config';
import { startTracing } from './infrastructure/observability/tracing';

startTracing();

import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { addLambdaAuthPath } from './infrastructure/presentation/swagger/lambda-auth.path';
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
      'Sistema de gestão de ordens de serviço de uma oficina mecânica — ' +
        'Tech Challenge SOAT Fase 3.\n\n' +
        '**Dois caminhos de autenticação, para dois públicos:**\n\n' +
        '- **Cliente da oficina** — `POST /auth/cpf`, atendida por uma função ' +
        'serverless. Identifica-se só pelo CPF, não tem senha. O token que ela ' +
        'devolve dá acesso apenas aos dados do próprio cliente.\n' +
        '- **Funcionário** — `POST /api/auth/login`, com e-mail e senha, e um ' +
        'papel (`ADMIN`, `MECHANIC` ou `ATTENDANT`).\n\n' +
        'Use o botão **Authorize** acima para colar o `accessToken` de qualquer ' +
        'um dos dois e experimentar as rotas protegidas.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = addLambdaAuthPath(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      // Mantém o token depois de recarregar a página — sem isto, toda
      // atualização obriga a autenticar de novo, o que atrapalha tanto o uso
      // real quanto uma demonstração ao vivo.
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
    },
    customSiteTitle: 'Oficina Backend API — Fase 3',
  });

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  app.get(Logger).log(`Aplicação ouvindo na porta ${port}`);
}
void bootstrap();
