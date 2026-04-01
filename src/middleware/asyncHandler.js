import { errorHandler } from './errorHandler.js';

export const asyncHandler = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => errorHandler(err, req, res));
