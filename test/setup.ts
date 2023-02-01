import express, { Request, Response } from "express";

export const port = process.env.TP_MOCK_PORT || 9876;

export default async () =>
  new Promise<void>((resolve) => {
    const app = express();
    app.get("*", (req: Request, res: Response) =>
      res.status(200).send({
        method: req.method,
        protocol: req.protocol,
        version: req.httpVersion,
        host: req.hostname,
        headers: req.headers,
        path: req.path,
        query: req.query,
        body: req.body,
      })
    );
    const server = app.listen(port, () => {
      console.log(`Mock server started on ${port}`);
      resolve();
    });
    //@ts-expect-error jest globals not typed
    globalThis.__MOCK_HTTP_API__ = server;
  });
