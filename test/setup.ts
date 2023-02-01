import express, { Request, Response } from "express";

const port = process.env.TP_MOCK_PORT || 9876

const app = express();
app.all("*", (req: Request, res: Response) =>
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
app.listen(port, () => console.log(`Mock server started on ${port}`));
