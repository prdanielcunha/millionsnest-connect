import type express from 'express';
/** Deployed staging can share identity reads, but must not mutate live Firebase data. */
export const homologationReadOnly: express.RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  res.setHeader('Cache-Control', 'no-store');
  res.status(409).json({ code: 'HOMOLOGATION_READ_ONLY' });
};
