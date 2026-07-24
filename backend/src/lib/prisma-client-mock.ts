/**
 * Prisma Client Mock
 *
 * Mapped to "@prisma/client" by moduleNameMapper in jest.config.js so Jest
 * never tries to resolve / generate the real Prisma client. The project uses
 * Drizzle ORM for all DB access; Prisma is only a transitive dependency.
 */

export class PrismaClient {
  $connect() { return Promise.resolve(); }
  $disconnect() { return Promise.resolve(); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction(fn: (tx: any) => Promise<any>) { return fn(this); }
}

export default { PrismaClient };
