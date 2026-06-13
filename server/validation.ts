import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(512),
});

const recipeSchema = z
  .object({
    id: z.string().min(1).max(180),
    title: z.string().min(1).max(180),
    ingredients: z.array(z.string()).max(200),
    steps: z.array(z.object({ text: z.string() }).passthrough()).max(100),
  })
  .passthrough();

const collectionSchema = z
  .object({
    id: z.string().min(1).max(180),
    label: z.string().min(1).max(180),
    recipeIds: z.array(z.string()).max(500),
  })
  .passthrough();

export const archiveSchema = z.object({
  recipes: z.array(recipeSchema).max(500),
  collections: z.array(collectionSchema).max(100),
});
