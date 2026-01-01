import { z } from "zod";
import { reports } from "./schema";

export const api = {
  analyze: {
    method: "POST" as const,
    path: "/api/analyze",
    // Input is FormData (file + password), so no strict Zod schema for body here
    responses: {
      200: z.custom<typeof reports.$inferSelect>(), // Returns the saved report
      400: z.object({ message: z.string() }),
      401: z.object({ message: z.string() }), // Incorrect password
      500: z.object({ message: z.string() }),
    },
  },
  reports: {
    list: {
      method: "GET" as const,
      path: "/api/reports",
      responses: {
        200: z.array(z.custom<typeof reports.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/reports/:id",
      responses: {
        200: z.custom<typeof reports.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
  },
};
