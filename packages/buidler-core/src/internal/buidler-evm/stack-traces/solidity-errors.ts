import { bufferToHex } from "ethereumjs-util";
import { inspect } from "util";

import { decodeRevertReason } from "./revert-reasons";
import {
  CONSTRUCTOR_FUNCTION_NAME,
  PRECOMPILE_FUNCTION_NAME,
  SolidityStackTrace,
  SolidityStackTraceEntry,
  SourceReference,
  StackTraceEntryType,
  UNKNOWN_FUNCTION_NAME,
  UNRECOGNIZED_CONTRACT_NAME,
  UNRECOGNIZED_FUNCTION_NAME,
} from "./solidity-stack-trace";

export function getCurrentStack(): NodeJS.CallSite[] {
  const previousPrepareStackTrace = Error.prepareStackTrace;

  Error.prepareStackTrace = (e, s) => s;

  const error = new Error();
  const stack: NodeJS.CallSite[] = error.stack as any;

  Error.prepareStackTrace = previousPrepareStackTrace;

  return stack;
}

export async function wrapWithSolidityErrorsCorrection(
  f: () => any,
  stackFramesToRemove: number
) {
  const stackTraceAtCall = getCurrentStack().slice(stackFramesToRemove);

  try {
    return await f();
  } catch (error) {
    if (error.stackTrace === undefined) {
      // tslint:disable-next-line only-buidler-error
      throw error;
    }

    // tslint:disable-next-line only-buidler-error
    throw encodeSolidityStackTrace(
      error.message,
      error.stackTrace,
      stackTraceAtCall
    );
  }
}

export function encodeSolidityStackTrace(
  fallbackMessage: string,
  stackTrace: SolidityStackTrace,
  previousStack?: NodeJS.CallSite[]
): SolidityError {
  if (Error.prepareStackTrace === undefined) {
    // Node 12 doesn't have a default Error.prepareStackTrace
    require("source-map-support/register");
  }

  const previousPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (error, stack) => {
    if (previousStack !== undefined) {
      stack = previousStack;
    } else {
      // We remove BuidlerEVM related stack traces
      stack.splice(0, 3);
    }

    for (const entry of stackTrace) {
      const callsite = encodeStackTraceEntry(entry);
      if (callsite === undefined) {
        continue;
      }

      stack.unshift(callsite);
    }

    return previousPrepareStackTrace!(error, stack);
  };

  const msg = getMessageFromLastStackTraceEntry(
    stackTrace[stackTrace.length - 1]
  );

  const solidityError = new SolidityError(
    msg !== undefined ? msg : fallbackMessage,
    stackTrace
  );

  // This hack is here because prepare stack is lazy
  solidityError.stack = solidityError.stack;

  Error.prepareStackTrace = previousPrepareStackTrace;

  return solidityError;
}

function encodeStackTraceEntry(
  stackTraceEntry: SolidityStackTraceEntry
): SolidityCallSite {
  switch (stackTraceEntry.type) {
    case StackTraceEntryType.UNRECOGNIZED_FUNCTION_WITHOUT_FALLBACK_ERROR:
    case StackTraceEntryType.MISSING_FALLBACK_OR_RECEIVE_ERROR:
      return sourceReferenceToSolidityCallsite({
        ...stackTraceEntry.sourceReference,
        function: UNRECOGNIZED_FUNCTION_NAME,
      });

    case StackTraceEntryType.CALLSTACK_ENTRY:
    case StackTraceEntryType.REVERT_ERROR:
    case StackTraceEntryType.FUNCTION_NOT_PAYABLE_ERROR:
    case StackTraceEntryType.INVALID_PARAMS_ERROR:
    case StackTraceEntryType.FALLBACK_NOT_PAYABLE_ERROR:
    case StackTraceEntryType.FALLBACK_NOT_PAYABLE_AND_NO_RECEIVE_ERROR:
    case StackTraceEntryType.RETURNDATA_SIZE_ERROR:
    case StackTraceEntryType.NONCONTRACT_ACCOUNT_CALLED_ERROR:
    case StackTraceEntryType.CALL_FAILED_ERROR:
    case StackTraceEntryType.DIRECT_LIBRARY_CALL_ERROR:
    case StackTraceEntryType.UNMAPPED_SOLC_0_6_3_REVERT_ERROR:
    case StackTraceEntryType.CONTRACT_TOO_LARGE_ERROR:
      return sourceReferenceToSolidityCallsite(stackTraceEntry.sourceReference);

    case StackTraceEntryType.UNRECOGNIZED_CREATE_CALLSTACK_ENTRY:
      return new SolidityCallSite(
        undefined,
        UNRECOGNIZED_CONTRACT_NAME,
        CONSTRUCTOR_FUNCTION_NAME,
        undefined
      );

    case StackTraceEntryType.UNRECOGNIZED_CONTRACT_CALLSTACK_ENTRY:
      return new SolidityCallSite(
        bufferToHex(stackTraceEntry.address),
        UNRECOGNIZED_CONTRACT_NAME,
        UNKNOWN_FUNCTION_NAME,
        undefined
      );

    case StackTraceEntryType.PRECOMPILE_ERROR:
      return new SolidityCallSite(
        undefined,
        `<PrecompileContract ${stackTraceEntry.precompile}>`,
        PRECOMPILE_FUNCTION_NAME,
        undefined
      );

    case StackTraceEntryType.UNRECOGNIZED_CREATE_ERROR:
      return new SolidityCallSite(
        undefined,
        UNRECOGNIZED_CONTRACT_NAME,
        CONSTRUCTOR_FUNCTION_NAME,
        undefined
      );

    case StackTraceEntryType.UNRECOGNIZED_CONTRACT_ERROR:
      return new SolidityCallSite(
        bufferToHex(stackTraceEntry.address),
        UNRECOGNIZED_CONTRACT_NAME,
        UNKNOWN_FUNCTION_NAME,
        undefined
      );

    case StackTraceEntryType.INTERNAL_FUNCTION_CALLSTACK_ENTRY:
      return new SolidityCallSite(
        stackTraceEntry.sourceReference.file.globalName,
        stackTraceEntry.sourceReference.contract,
        `internal@${stackTraceEntry.pc}`,
        undefined
      );

    case StackTraceEntryType.OTHER_EXECUTION_ERROR:
      if (stackTraceEntry.sourceReference === undefined) {
        return new SolidityCallSite(
          undefined,
          UNRECOGNIZED_CONTRACT_NAME,
          UNKNOWN_FUNCTION_NAME,
          undefined
        );
      }

      return sourceReferenceToSolidityCallsite(stackTraceEntry.sourceReference);
  }
}

function sourceReferenceToSolidityCallsite(
  sourceReference: SourceReference
): SolidityCallSite {
  return new SolidityCallSite(
    sourceReference.file.globalName,
    sourceReference.contract,
    sourceReference.function !== undefined
      ? sourceReference.function
      : UNKNOWN_FUNCTION_NAME,
    sourceReference.line
  );
}

function getMessageFromLastStackTraceEntry(
  stackTraceEntry: SolidityStackTraceEntry
): string | undefined {
  switch (stackTraceEntry.type) {
    case StackTraceEntryType.PRECOMPILE_ERROR:
      return `Transaction reverted: call to precompile ${stackTraceEntry.precompile} failed`;

    case StackTraceEntryType.FUNCTION_NOT_PAYABLE_ERROR:
      return `Transaction reverted: non-payable function was called with value ${stackTraceEntry.value.toString(
        10
      )}`;

    case StackTraceEntryType.INVALID_PARAMS_ERROR:
      return `Transaction reverted: function was called with incorrect parameters`;

    case StackTraceEntryType.FALLBACK_NOT_PAYABLE_ERROR:
      return `Transaction reverted: fallback function is not payable and was called with value ${stackTraceEntry.value.toString(
        10
      )}`;

    case StackTraceEntryType.FALLBACK_NOT_PAYABLE_AND_NO_RECEIVE_ERROR:
      return `Transaction reverted: there's no receive function, fallback function is not payable and was called with value ${stackTraceEntry.value.toString(
        10
      )}`;

    case StackTraceEntryType.UNRECOGNIZED_FUNCTION_WITHOUT_FALLBACK_ERROR:
      return `Transaction reverted: function selector was not recognized and there's no fallback function`;

    case StackTraceEntryType.MISSING_FALLBACK_OR_RECEIVE_ERROR:
      return `Transaction reverted: function selector was not recognized and there's no fallback nor receive function`;

    case StackTraceEntryType.RETURNDATA_SIZE_ERROR:
      return `Transaction reverted: function returned an unexpected amount of data`;

    case StackTraceEntryType.NONCONTRACT_ACCOUNT_CALLED_ERROR:
      return `Transaction reverted: function call to a non-contract account`;

    case StackTraceEntryType.CALL_FAILED_ERROR:
      return `Transaction reverted: function call failed to execute`;

    case StackTraceEntryType.DIRECT_LIBRARY_CALL_ERROR:
      return `Transaction reverted: library was called directly`;

    case StackTraceEntryType.UNRECOGNIZED_CREATE_ERROR:
    case StackTraceEntryType.UNRECOGNIZED_CONTRACT_ERROR:
      if (stackTraceEntry.message.length > 0) {
        return `VM Exception while processing transaction: revert ${decodeRevertReason(
          stackTraceEntry.message
        )}`;
      }

      return "Transaction reverted without a reason";

    case StackTraceEntryType.REVERT_ERROR:
      if (stackTraceEntry.message.length > 0) {
        return `VM Exception while processing transaction: revert ${decodeRevertReason(
          stackTraceEntry.message
        )}`;
      }

      if (stackTraceEntry.isInvalidOpcodeError) {
        return "VM Exception while processing transaction: invalid opcode";
      }

      return "Transaction reverted without a reason";

    case StackTraceEntryType.OTHER_EXECUTION_ERROR:
      return `Transaction reverted for an unrecognized reason. Please report this to help us improve Buidler.`;

    case StackTraceEntryType.UNMAPPED_SOLC_0_6_3_REVERT_ERROR:
      return "Transaction reverted without a reason and without a valid sourcemap provided by the compiler. Some line numbers may be off. We strongly recommend upgrading solc and always using revert reasons.";

    case StackTraceEntryType.CONTRACT_TOO_LARGE_ERROR:
      return "Transaction reverted: trying to deploy a contract whose code is too large";
  }
}

// Note: This error class MUST NOT extend BuidlerEVMProviderError, as libraries
//   use the code property to detect if they are dealing with a JSON-RPC error,
//   and take control of errors.
export class SolidityError extends Error {
  public readonly stackTrace: SolidityStackTrace;

  constructor(message: string, stackTrace: SolidityStackTrace) {
    super(message);
    this.stackTrace = stackTrace;
  }

  public [inspect.custom](): string {
    return this.inspect();
  }

  public inspect(): string {
    return this.stack !== undefined
      ? this.stack
      : "Internal error when encoding SolidityError";
  }
}

class SolidityCallSite implements NodeJS.CallSite {
  constructor(
    private _fileGlobalName: string | undefined,
    private _contract: string,
    private _functionName: string | undefined,
    private _line: number | undefined
  ) {}

  public getColumnNumber() {
    return null;
  }

  public getEvalOrigin() {
    return undefined;
  }

  public getFileName() {
    return this._fileGlobalName !== undefined
      ? this._fileGlobalName
      : "unknown";
  }

  public getFunction() {
    return undefined;
  }

  public getFunctionName() {
    return null;
  }

  public getLineNumber() {
    return this._line !== undefined ? this._line : null;
  }

  public getMethodName() {
    return this._functionName !== undefined ? this._functionName : null;
  }

  public getPosition() {
    return 0;
  }

  public getPromiseIndex() {
    return 0;
  }

  public getScriptNameOrSourceURL() {
    return null;
  }

  public getThis() {
    return undefined;
  }

  public getTypeName() {
    return this._contract;
  }

  public isAsync() {
    return false;
  }

  public isConstructor() {
    return false;
  }

  public isEval() {
    return false;
  }

  public isNative() {
    return false;
  }

  public isPromiseAll() {
    return false;
  }

  public isToplevel() {
    return false;
  }
}
