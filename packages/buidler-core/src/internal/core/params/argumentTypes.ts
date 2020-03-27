import * as fs from "fs";
import fsExtra from "fs-extra";

import { BuidlerError } from "../errors";
import { ERRORS } from "../errors-list";

/**
 * Provides an interface for every valid task argument type.
 */
export interface ArgumentType<T> {
  /**
   * Type's name.
   */
  name: string;

  /**
   * Parses strValue. This function MUST throw BDLR301 if it
   * can parse the given value.
   *
   * @param argName argument's name - used for context in case of error.
   * @param strValue argument's string value to be parsed.
   *
   * @throws BDLR301 if an invalid value is given.
   * @returns the parsed value.
   */
  parse(argName: string, strValue: string): T;

  /**
   * Check if argument value is of type <T>. Optional method.
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param argumentValue - value to be validated
   * @param isVariadic {boolean} if true, value is an array of items of this.type
   *
   * @throws BDLR301 if value is not of type <t>
   */
  validate?(argName: string, argumentValue: any, isVariadic?: boolean): void;
}

/**
 * is valid if value fulfills a validator.
 * Value to test may be either a single item, or variadic (multiple) items of the same type
 *
 * @param value - the data to be tested
 * @param validator - the test function
 * @param isVariadic - wether the value is a single item, or comprised of multiple items
 * @return isValid {boolean}
 * @private
 */
function _isValidValueOrArrayOfValues(
  value: any,
  validator: (item: any) => boolean,
  isVariadic?: boolean
): boolean {
  const data: any[] = isVariadic ? value : [value];
  try {
    // isValid if all items in data[] are valid
    return data.every(validator);
  } catch (error) {
    // on error, we just assume invalid data
    return false;
  }
}

/**
 * String type.
 *
 * Accepts any kind of string.
 */
export const string: ArgumentType<string> = {
  name: "string",
  parse: (argName, strValue) => strValue,
  /**
   * Check if argument value is of type "string"
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   * @param isVariadic - if true, value is an array of items to be type validated each
   *
   * @throws BDLR301 if value is not of type "string"
   */
  validate: (argName: string, value: any, isVariadic?: boolean): void => {
    const isValid = _isValidValueOrArrayOfValues(
      value,
      item => typeof item === "string",
      isVariadic
    );

    if (!isValid) {
      throw new BuidlerError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: string.name
      });
    }
  }
};

/**
 * Boolean type.
 *
 * Accepts only 'true' or 'false' (case-insensitive).
 * @throws BDLR301
 */
export const boolean: ArgumentType<boolean> = {
  name: "boolean",
  parse: (argName, strValue) => {
    if (strValue.toLowerCase() === "true") {
      return true;
    }
    if (strValue.toLowerCase() === "false") {
      return false;
    }

    throw new BuidlerError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
      value: strValue,
      name: argName,
      type: "boolean"
    });
  },
  /**
   * Check if argument value is of type "boolean"
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   * @param isVariadic - if true, value is an array of items to be type validated each
   *
   * @throws BDLR301 if value is not of type "boolean"
   */
  validate: (argName: string, value: any, isVariadic?: boolean): void => {
    const isValid = _isValidValueOrArrayOfValues(
      value,
      item => typeof item === "boolean",
      isVariadic
    );

    if (!isValid) {
      throw new BuidlerError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: boolean.name
      });
    }
  }
};

/**
 * Int type.
 * Accepts either a decimal string integer or hexadecimal string integer.
 * @throws BDLR301
 */
export const int: ArgumentType<number> = {
  name: "int",
  parse: (argName, strValue) => {
    const decimalPattern = /^\d+(?:[eE]\d+)?$/;
    const hexPattern = /^0[xX][\dABCDEabcde]+$/;

    if (
      strValue.match(decimalPattern) === null &&
      strValue.match(hexPattern) === null
    ) {
      throw new BuidlerError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value: strValue,
        name: argName,
        type: int.name
      });
    }

    return Number(strValue);
  },
  /**
   * Check if argument value is of type "int"
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   * @param isVariadic - if true, value is an array of items to be type validated each
   *
   * @throws BDLR301 if value is not of type "int"
   */
  validate: (argName: string, value: any, isVariadic?: boolean): void => {
    const isValid = _isValidValueOrArrayOfValues(
      value,
      Number.isInteger,
      isVariadic
    );
    if (!isValid) {
      throw new BuidlerError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: int.name
      });
    }
  }
};

/**
 * Float type.
 * Accepts either a decimal string number or hexadecimal string number.
 * @throws BDLR301
 */
export const float: ArgumentType<number> = {
  name: "float",
  parse: (argName, strValue) => {
    const decimalPattern = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE]\d+)?$/;
    const hexPattern = /^0[xX][\dABCDEabcde]+$/;

    if (
      strValue.match(decimalPattern) === null &&
      strValue.match(hexPattern) === null
    ) {
      throw new BuidlerError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value: strValue,
        name: argName,
        type: float.name
      });
    }

    return Number(strValue);
  },
  /**
   * Check if argument value is of type "float".
   * Both decimal and integer number values are valid.
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   * @param isVariadic - if true, value is an array of items to be type validated each
   *
   * @throws BDLR301 if value is not of type "number"
   */
  validate: (argName: string, value: any, isVariadic?: boolean): void => {
    const isValid = _isValidValueOrArrayOfValues(
      value,
      item => typeof item === "number" && !isNaN(item),
      isVariadic
    );

    if (!isValid) {
      throw new BuidlerError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: float.name
      });
    }
  }
};

/**
 * Input file type.
 * Accepts a path to a readable file..
 * @throws BDLR302
 */
export const inputFile: ArgumentType<string> = {
  name: "inputFile",
  parse(argName: string, strValue: string): string {
    try {
      fs.accessSync(strValue, fsExtra.constants.R_OK);
      const stats = fs.lstatSync(strValue);

      if (stats.isDirectory()) {
        // This is caught and encapsulated in a buidler error.
        // tslint:disable-next-line only-buidler-error
        throw new Error(`${strValue} is a directory, not a file`);
      }
    } catch (error) {
      throw new BuidlerError(
        ERRORS.ARGUMENTS.INVALID_INPUT_FILE,
        {
          name: argName,
          value: strValue
        },
        error
      );
    }

    return strValue;
  },
  /**
   * Check if argument value is of type "inputFile"
   * File string validation succeeds if it can be parsed, ie. is a valid accessible file dir
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   * @param isVariadic - if true, value is an array of items to be type validated each
   *
   * @throws BDLR301 if value is not of type "inputFile"
   */
  validate: (argName: string, value: any, isVariadic?: boolean): void => {
    const isValid = _isValidValueOrArrayOfValues(
      value,
      item => {
        // is valid if it can be parsed (will  throw otherwise)
        inputFile.parse(argName, item);
        return true;
      },
      isVariadic
    );
    if (!isValid) {
      throw new BuidlerError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: inputFile.name
      });
    }
  }
};

export const json: ArgumentType<any> = {
  name: "json",
  parse(argName: string, strValue: string): any {
    try {
      return JSON.parse(strValue);
    } catch (error) {
      throw new BuidlerError(
        ERRORS.ARGUMENTS.INVALID_JSON_ARGUMENT,
        {
          param: argName,
          error: error.message
        },
        error
      );
    }
  },
  /**
   * Check if argument value is of type "json"
   * "json" validation succeeds if it is of "object map"-like structure or of "array" structure
   * ie. this excludes 'null', function, numbers, date, regexp, etc.
   *
   * @param argName {string} argument's name - used for context in case of error.
   * @param value {any} argument's value to validate.
   * @param isVariadic - if true, value is an array of items to be type validated each
   *
   * @throws BDLR301 if value is not of type "json"
   */
  validate: (argName: string, value: any, isVariadic?: boolean): void => {
    const isJsonValue = (item: any) => {
      const valueTypeString = Object.prototype.toString.call(item);
      return (
        valueTypeString === "[object Object]" ||
        valueTypeString === "[object Array]"
      );
    };

    const isValid = _isValidValueOrArrayOfValues(
      value,
      isJsonValue,
      isVariadic
    );
    if (!isValid) {
      throw new BuidlerError(ERRORS.ARGUMENTS.INVALID_VALUE_FOR_TYPE, {
        value,
        name: argName,
        type: json.name
      });
    }
  }
};
