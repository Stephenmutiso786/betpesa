import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

export const subjectsRouter = Router();

const subjectSchema = z.object({
  name: z.string().trim().min(2),
  code: z.string().trim().min(2).transform((value: string) => value.toUpperCase())
});

const updateSubjectSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    code: z.string().trim().min(2).transform((value: string) => value.toUpperCase()).optional()
  })
  .refine((data: { name?: string; code?: string }) => Object.keys(data).length > 0, {
    message: "At least one field is required"
  });

const subjectIdParamsSchema = z.object({
  id: z.string().min(1)
});

const listSubjectsQuerySchema = z.object({
  search: z.string().trim().optional()
});

subjectsRouter.get("/", async (req: any, res: any) => {
  const parsed = listSubjectsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const where: any = {};
  if (parsed.data.search && parsed.data.search.length > 0) {
    where.OR = [
      { name: { contains: parsed.data.search, mode: "insensitive" } },
      { code: { contains: parsed.data.search, mode: "insensitive" } }
    ];
  }

  const subjects = await prisma.subject.findMany({
    where,
    orderBy: { createdAt: "desc" }
  });

  res.json({ ok: true, subjects });
});

subjectsRouter.post("/", async (req: any, res: any) => {
  const parsed = subjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const actorUserId = req.authUser?.sub as string | undefined;

  try {
    const created = await prisma.$transaction(async (tx: any) => {
      const subject = await tx.subject.create({ data: parsed.data });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId || null,
          action: "SUBJECT_CREATED",
          details: {
            subjectId: subject.id,
            name: subject.name,
            code: subject.code
          }
        }
      });

      return subject;
    });

    return res.status(201).json({ ok: true, subject: created });
  } catch (error: unknown) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Failed to create subject" });
  }
});

subjectsRouter.patch("/:id", async (req: any, res: any) => {
  const parsedParams = subjectIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ ok: false, error: parsedParams.error.flatten() });
  }

  const parsedBody = updateSubjectSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ ok: false, error: parsedBody.error.flatten() });
  }

  const actorUserId = req.authUser?.sub as string | undefined;

  try {
    const existing = await prisma.subject.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true, name: true, code: true }
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Subject not found" });
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const subject = await tx.subject.update({
        where: { id: parsedParams.data.id },
        data: parsedBody.data
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId || null,
          action: "SUBJECT_UPDATED",
          details: {
            subjectId: subject.id,
            previous: {
              name: existing.name,
              code: existing.code
            },
            next: {
              name: subject.name,
              code: subject.code
            }
          }
        }
      });

      return subject;
    });

    return res.json({ ok: true, subject: updated });
  } catch (error: unknown) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Failed to update subject" });
  }
});

subjectsRouter.delete("/:id", async (req: any, res: any) => {
  const parsedParams = subjectIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ ok: false, error: parsedParams.error.flatten() });
  }

  const actorUserId = req.authUser?.sub as string | undefined;

  try {
    const existing = await prisma.subject.findUnique({
      where: { id: parsedParams.data.id },
      select: { id: true, name: true, code: true }
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Subject not found" });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.subject.delete({ where: { id: parsedParams.data.id } });

      await tx.auditLog.create({
        data: {
          actorUserId: actorUserId || null,
          action: "SUBJECT_DELETED",
          details: {
            subjectId: existing.id,
            name: existing.name,
            code: existing.code
          }
        }
      });
    });

    return res.json({ ok: true, deletedId: existing.id });
  } catch (error: unknown) {
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Failed to delete subject" });
  }
});
