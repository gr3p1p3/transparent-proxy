module.exports = async () =>
  new Promise((resolve) => {
    globalThis.__MOCK_HTTP_API__.close(() => {
      console.log("Stopped Mock API");
      resolve();
    });
  });
