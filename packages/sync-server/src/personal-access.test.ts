import request from 'supertest';

import { app } from './app';

describe('personal server', () => {
  it.each([
    ['get', '/admin/users'],
    ['post', '/admin/users'],
    ['patch', '/admin/users'],
    ['delete', '/admin/users'],
    ['get', '/admin/access'],
    ['post', '/admin/access'],
    ['delete', '/admin/access'],
    ['post', '/admin/access/transfer-ownership'],
  ] as const)('removes %s %s even for the owner', async (method, path) => {
    const response = await request(app)
      [method](path)
      .set('X-ACTUAL-TOKEN', 'valid-token-admin')
      .send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ status: 'error', reason: 'not-found' });
  });

  it('advertises personal mode while retaining login and server health', async () => {
    const bootstrap = await request(app).get('/account/needs-bootstrap');
    expect(bootstrap.status).toBe(200);
    expect(bootstrap.body.data.multiuser).toBe(false);
    expect(bootstrap.body.data.availableLoginMethods).toBeInstanceOf(Array);
    expect((await request(app).get('/health')).status).toBe(200);
  });
});
