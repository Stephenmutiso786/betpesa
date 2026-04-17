import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subject: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  } as any
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: mockPrisma
}));

import { subjectsRouter } from "../src/modules/subjects/index.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.authUser = { sub: "teacher-1", role: "teacher" };
    next();
  });
  app.use("/api/subjects", subjectsRouter);
  return app;
}

describe("subjects routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists subjects", async () => {
    mockPrisma.subject.findMany.mockResolvedValue([
      {
        id: "s1",
        name: "Mathematics",
        code: "MATH",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const app = createApp();
    const response = await request(app).get("/api/subjects?search=math");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.subjects).toHaveLength(1);
    expect(mockPrisma.subject.findMany).toHaveBeenCalledOnce();
  });

  it("creates subject and writes audit log", async () => {
    const createdSubject = {
      id: "s1",
      name: "Mathematics",
      code: "MATH",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        subject: {
          create: vi.fn().mockResolvedValue(createdSubject)
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "log-1" })
        }
      });
    });

    const app = createApp();
    const response = await request(app).post("/api/subjects").send({
      name: "Mathematics",
      code: "math"
    });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.subject.code).toBe("MATH");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it("updates subject and writes audit log", async () => {
    mockPrisma.subject.findUnique.mockResolvedValue({
      id: "s1",
      name: "Mathematics",
      code: "MATH"
    });

    const updatedSubject = {
      id: "s1",
      name: "Advanced Mathematics",
      code: "AMATH",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        subject: {
          update: vi.fn().mockResolvedValue(updatedSubject)
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "log-2" })
        }
      });
    });

    const app = createApp();
    const response = await request(app).patch("/api/subjects/s1").send({
      name: "Advanced Mathematics",
      code: "amath"
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.subject.code).toBe("AMATH");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it("returns 404 when updating missing subject", async () => {
    mockPrisma.subject.findUnique.mockResolvedValue(null);

    const app = createApp();
    const response = await request(app).patch("/api/subjects/missing").send({
      name: "Advanced Mathematics"
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Subject not found");
  });

  it("deletes subject and writes audit log", async () => {
    mockPrisma.subject.findUnique.mockResolvedValue({
      id: "s1",
      name: "Mathematics",
      code: "MATH"
    });

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        subject: {
          delete: vi.fn().mockResolvedValue({ id: "s1" })
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "log-3" })
        }
      });
    });

    const app = createApp();
    const response = await request(app).delete("/api/subjects/s1");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.deletedId).toBe("s1");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });
});
