import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { validateBody } from "../middleware/validate.js";
import { pharmacyCreateSchema, type PharmacyCreateInput } from "../schemas/pharmacy.js";

export const pharmaciesRouter = Router();

pharmaciesRouter.get("/", async (_req, res) => {
  const pharmacies = await prisma.pharmacy.findMany({ orderBy: { name: "asc" } });
  res.json(pharmacies);
});

pharmaciesRouter.post(
  "/",
  validateBody(pharmacyCreateSchema),
  async (req, res) => {
    const data = req.body as PharmacyCreateInput;
    const pharmacy = await prisma.pharmacy.create({ data });
    res.status(201).json(pharmacy); // 201 = Created
  },
);