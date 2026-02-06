import {mockDeep, mockReset, DeepMockProxy} from 'vitest-mock-extended';
import {vi, beforeEach} from 'vitest';
import {PrismaClient} from '../src/generated/prisma/client';
import {prisma} from '../src/database';

vi.mock('../src/database', () => ({
    prisma: mockDeep<PrismaClient>()
}));

vi.mock('bcryptjs');

vi.mock('jsonwebtoken');

vi.mock('../src/auth/auth.middleware', () => ({
    authenticateToken: vi.fn((req, res, next) => {
        req.user = {
            userId: 1,
            email: 'test@test.com'
        }
        next()
    }),
}));

beforeEach(() => {
    mockReset(prismaMock);
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
