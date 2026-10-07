import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string().max(200),
      image: image(),
      imageAlt: z.string(),
      stack: z.array(z.string()).min(1),
      highlights: z.array(z.string()),
      url: z.string().url(),
      featured: z.boolean(),
      order: z.number().int(),
    }),
});

export const collections = { projects };
