import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const opts = {
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "fos-blog" },
};

const logger = isDev
  ? pino(
      opts,
      pino.transport({
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      }),
    )
  : pino(opts);

export default logger;
