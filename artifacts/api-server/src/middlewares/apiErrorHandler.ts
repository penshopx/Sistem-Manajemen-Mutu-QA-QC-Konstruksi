import type { ErrorRequestHandler } from "express";

export const apiErrorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  req.log.error({ err: error }, "API request failed");
  res.status(500).json({ error: "Permintaan gagal diproses. Silakan coba lagi." });
};