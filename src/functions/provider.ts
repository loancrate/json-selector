import { UnknownFunctionError } from "../errors";

import { makeExpressionRef } from "./datatype";
import { FunctionArg, FunctionCallArgs, FunctionDefinition } from "./types";
import { validateArguments } from "./validation";

/** Immutable lookup table mapping function names to their {@link FunctionDefinition}s. */
export type FunctionProvider = ReadonlyMap<string, FunctionDefinition>;

/** Resolves expression-ref arguments, validates argument types against the function's signatures, and invokes the handler. */
export function callFunction(
  provider: FunctionProvider,
  name: string,
  request: FunctionCallArgs,
): unknown {
  const func = provider.get(name);
  if (!func) {
    throw new UnknownFunctionError(name);
  }

  const { args: callArgs, context, evaluate } = request;

  const args: FunctionArg[] = callArgs.map((arg) => {
    if (arg.type === "expressionRef") {
      return makeExpressionRef(arg.expression);
    }
    return evaluate(arg, context);
  });

  validateArguments(name, args, func.signatures);

  return func.handler({ ...request, args });
}
