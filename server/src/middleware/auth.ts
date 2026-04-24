import { Hono } from 'hono';

const auth = new Hono();

auth.use('*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token || token !== process.env.AUTH_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

export default auth;
