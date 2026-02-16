import { FunctionProvider } from "../provider";
import { FunctionDefinition } from "../types";

import { registerArrayFunctions } from "./array";
import { registerMathFunctions } from "./math";
import { registerStringFunctions } from "./string";
import { registerTypeFunctions } from "./type";

let builtinProvider: FunctionProvider | undefined;

/** Returns a lazily-initialized singleton {@link FunctionProvider} containing all standard JMESPath built-in functions. */
export function getBuiltinFunctionProvider(): FunctionProvider {
  if (!builtinProvider) {
    const provider = new Map();

    const register = (def: FunctionDefinition) => {
      provider.set(def.name, def);
    };

    registerTypeFunctions(register);
    registerStringFunctions(register);
    registerMathFunctions(register);
    registerArrayFunctions(register);

    builtinProvider = provider;
  }
  return builtinProvider;
}
