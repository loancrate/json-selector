import { AccessorError, type AccessorErrorCode } from "../src/errors";

import { catchError } from "./helpers";

export function expectAccessorError(
  fn: () => void,
  code: AccessorErrorCode,
  operation: "get" | "set" | "delete",
  messagePart?: string,
): AccessorError {
  const error = catchError(fn);
  expect(error).toBeInstanceOf(AccessorError);
  if (!(error instanceof AccessorError)) {
    throw error;
  }
  expect(error).toMatchObject({
    name: "AccessorError",
    code,
    operation,
  });
  if (messagePart) {
    expect(error.message).toContain(messagePart);
  }
  return error;
}
