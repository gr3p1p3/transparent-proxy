const express = require("express");
const port = process.env.TP_MOCK_PORT || 9876;

module.exports = async () =>
  new Promise((resolve) => {
    const app = express();
    app.get("*", (req, res) =>
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
    globalThis.__MOCK_HTTP_API__ = server;
  });
