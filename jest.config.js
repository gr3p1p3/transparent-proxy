
const config = {
  testRegex: "test\/.+\.(test|spec)\\.js$",
  testEnvironment: 'node',
  globalSetup: "./test/setup.js",
  globalTeardown: "./test/teardown.js",
};

module.exports = config;