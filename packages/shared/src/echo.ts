import { z } from "zod";

/** POST /api/echo request — see specs/003-hono-server/contracts/echo-route.md */
export const EchoRequestSchema = z.object({
  message: z.string().min(1).max(500),
});
export type EchoRequest = z.infer<typeof EchoRequestSchema>;

/** POST /api/echo response */
export const EchoResponseSchema = z.object({
  message: z.string(),
  receivedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "receivedAt must be an ISO-8601 timestamp",
  }),
});
export type EchoResponse = z.infer<typeof EchoResponseSchema>;
