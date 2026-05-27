import morgan from "morgan";

/** @type {import("express").RequestHandler} */
export const requestLogger = morgan("combined");
