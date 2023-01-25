/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  reporters: [
    "default",
    ["jest-junit", { outputDirectory: "test-results/jest" }],
  ],
};
