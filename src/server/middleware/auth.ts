import { Context } from 'koa';
import * as jwt from 'jsonwebtoken';
import { secret } from '../config';
import { getUser } from '../service/database';

export default async (ctx: Context, next: () => Promise<any>) => {
  console.log(ctx.url, ctx.method);
  const urls = ['/currentroom', '/createroom', '/joinroom', '/profile', '/updateprofile'];
  if (urls.indexOf(ctx.url) != -1) {
    try {
      const user = jwt.verify(ctx.headers.authorization || '', secret);
      const username = user.split('@')[0];
      ctx.user = username;
      
      // 检查用户是否存在于数据库中
      const dbUser = getUser(username);
      if (!dbUser) {
        return (ctx.error = 'user not found in database, please register again');
      }
    } catch (e) {
      return (ctx.error = 'invalid token, logout plz');
    }
  }
  await next();
  console.log(
    new Date(),
    ctx.request.method,
    ctx.status,
    /^(4|5)/.test(`${ctx.status}`) ? ctx.url.red : ctx.url.green
  );
};
