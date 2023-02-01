import type { Config } from "jest";

const config: Config = {
  testMatch: ["**/?(*.)+(spec|test).ts?(x)"],
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: "./test/setup.ts",
  globalTeardown: "./test/teardown.ts",
};

export default config;
