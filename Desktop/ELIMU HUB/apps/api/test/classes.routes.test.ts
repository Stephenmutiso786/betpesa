import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    schoolClass: {
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

import { classesRouter } from "../src/modules/classes/index.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.authUser = { sub: "admin-1", role: "admin" };
    next();
  });
  app.use("/api/classes", classesRouter);
  return app;
}

describe("classes routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists classes", async () => {
    mockPrisma.schoolClass.findMany.mockResolvedValue([
      {
        id: "c1",
        name: "Senior One A",
        code: "S1A",
        level: "Senior 1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]);

    const app = createApp();
    const response = await request(app).get("/api/classes?search=one");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.classes).toHaveLength(1);
    expect(mockPrisma.schoolClass.findMany).toHaveBeenCalledOnce();
  });

  it("creates class and writes audit log", async () => {
    const createdClass = {
      id: "c1",
      name: "Senior One A",
      code: "S1A",
      level: "Senior 1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        schoolClass: {
          create: vi.fn().mockResolvedValue(createdClass)
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "log-1" })
        }
      });
    });

    const app = createApp();
    const response = await request(app).post("/api/classes").send({
      name: "Senior One A",
      code: "s1a",
      level: "Senior 1"
    });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.class.code).toBe("S1A");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it("updates class and writes audit log", async () => {
    mockPrisma.schoolClass.findUnique.mockResolvedValue({
      id: "c1",
      name: "Senior One A",
      code: "S1A",
      level: "Senior 1"
    });

    const updatedClass = {
      id: "c1",
      name: "Senior One East",
      code: "S1E",
      level: "Senior 1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        schoolClass: {
          update: vi.fn().mockResolvedValue(updatedClass)
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "log-2" })
        }
      });
    });

    const app = createApp();
    const response = await request(app).patch("/api/classes/c1").send({
      name: "Senior One East",
      code: "s1e"
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.class.code).toBe("S1E");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it("returns 404 when updating missing class", async () => {
    mockPrisma.schoolClass.findUnique.mockResolvedValue(null);

    const app = createApp();
    const response = await request(app).patch("/api/classes/missing").send({
      name: "Senior One East"
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Class not found");
  });

  it("deletes class and writes audit log", async () => {
    mockPrisma.schoolClass.findUnique.mockResolvedValue({
      id: "c1",
      name: "Senior One A",
      code: "S1A",
      level: "Senior 1"
    });

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        schoolClass: {
          delete: vi.fn().mockResolvedValue({ id: "c1" })
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "log-3" })
        }
      });
    });

    const app = createApp();
    const response = await request(app).delete("/api/classes/c1");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.deletedId).toBe("c1");
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });
});
