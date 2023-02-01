export default async () =>
  new Promise<void>((resolve) => {
    //@ts-expect-error jest globals not typed
    globalThis.__MOCK_HTTP_API__.close(() => {
      console.log("Stopped Mock API");
      resolve();
    });
  });
