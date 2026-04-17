import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

export const classesRouter = Router();

const classSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(2).transform((value: string) => value.toUpperCase()),
  level: z.string().trim().min(1).optional()
});

const updateClassSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    code: z.string().trim().min(2).transform((value: string) => value.toUpperCase()).optional(),
    level: z.string().trim().min(1).optional()
  })
  .refine((data: { name?: string; code?: string; level?: string }) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const classIdParamsSchema = z.object({
  id: z.string().min(1)
});

const listClassesQuerySchema = z.object({
  search: z.string().trim().optional(),
  level: z.string().trim().optional()
});

classesRouter.get("/", async (req: any, res: any) => {
  const parsed = listClassesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const where: any = {};
  if (parsed.data.level && parsed.data.level.length > 0) {
    where.level = { equals: parsed.data.level, mode: "insensitive" };
  }
  if (parsed.data.search && parsed.data.search.length > 0) {
    where.OR = [
      { name: { contains: parsed.data.search, mode: "insensitive" } },
      { code: { contains: parsed.data.search, mode: "insensitive" } }
    ];
  }

  const classes = await prisma.schoolClass.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  res.json({ ok: true, classes });
});

classesRouter.post("/", async (req: any, res: any) => {
  const parsed = classSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const actorUserId = req.authUser?.sub as string | undefined;

  try {
    const created = await prisma.$transaction(async (tx: any) => {
      const classItem = await tx.schoolClass.create({ data: parsed.data });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId || null,
          action: "CLASS_CREATED",
          details: {
            classId: classItem.id,
            name: classItem.name,
            code: classItem.code,
            level: classItem.level || null
          }
        }
      });

      return classItem;
    });

    return res.status(201).json({ ok: true, class: created });
  } catch (error: unknown) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Failed to create class" });
  }
});

classesRouter.patch("/:id", async (req: any, res: any) => {
  const parsedParams = classIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ ok: false, error: parsedParams.error.flatten() });
  }

  const parsedBody = updateClassSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ ok: false, error: parsedBody.error.flatten() });
  }

  const actorUserId = req.authUser?.sub as string | undefined;

  try {
    const existing = await prisma.schoolClass.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true, name: true, code: true, level: true }
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const classItem = await tx.schoolClass.update({
        where: { id: parsedParams.data.id },
        data: parsedBody.data
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId || null,
          action: "CLASS_UPDATED",
          details: {
            classId: classItem.id,
            previous: {
              name: existing.name,
              code: existing.code,
              level: existing.level || null
            },
            next: {
              name: classItem.name,
              code: classItem.code,
              level: classItem.level || null
            }
          }
        }
      });

      return classItem;
    });

    return res.json({ ok: true, class: updated });
  } catch (error: unknown) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Failed to update class" });
  }
});

classesRouter.delete("/:id", async (req: any, res: any) => {
  const parsedParams = classIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ ok: false, error: parsedParams.error.flatten() });
  }

  const actorUserId = req.authUser?.sub as string | undefined;

  try {
    const existing = await prisma.schoolClass.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true, name: true, code: true, level: true }
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.schoolClass.delete({ where: { id: parsedParams.data.id } });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId || null,
          action: "CLASS_DELETED",
          details: {
            classId: existing.id,
            name: existing.name,
            code: existing.code,
            level: existing.level || null
          }
        }
      });
    });

    return res.json({ ok: true, deletedId: existing.id });
  } catch (error: unknown) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Failed to delete class" });
  }
});
