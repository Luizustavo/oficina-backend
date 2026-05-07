import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/auth/login (POST) - rejects unknown credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'notfound@test.com', password: 'wrongpass' });
    expect([401, 500]).toContain(res.status);
  });

  it('/api/auth/login (POST) - returns 400 with invalid body', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '123' })
      .expect(400);
  });
});
