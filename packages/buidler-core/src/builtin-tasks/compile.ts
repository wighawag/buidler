import chalk from "chalk";
import debug from "debug";
import path from "path";

import {
  Artifacts,
  getArtifactFromContractOutput,
} from "../internal/artifacts";
import { internalTask, task, types } from "../internal/core/config/config-env";
import { assertBuidlerInvariant, BuidlerError } from "../internal/core/errors";
import { ERRORS } from "../internal/core/errors-list";
import {
  createCompilationJobFromFile,
  createCompilationJobsFromConnectedComponent,
  mergeCompilationJobsWithoutBug,
} from "../internal/solidity/compilation-job";
import { Compiler } from "../internal/solidity/compiler";
import { getInputFromCompilationJob } from "../internal/solidity/compiler/compiler-input";
import { DependencyGraph } from "../internal/solidity/dependencyGraph";
import { Parser } from "../internal/solidity/parse";
import { ResolvedFile, Resolver } from "../internal/solidity/resolver";
import { localPathToSourceName } from "../internal/solidity/source-names";
import { glob } from "../internal/util/glob";
import { getCompilersDir } from "../internal/util/global-dir";
import { pluralize } from "../internal/util/strings";
import { unsafeObjectEntries, unsafeObjectKeys } from "../internal/util/unsafe";
import { SolcInput } from "../types";

import {
  TASK_COMPILE,
  TASK_COMPILE_GET_COMPILATION_TASKS,
  TASK_COMPILE_SOLIDITY,
  TASK_COMPILE_SOLIDITY_CHECK_ERRORS,
  TASK_COMPILE_SOLIDITY_COMPILE,
  TASK_COMPILE_SOLIDITY_COMPILE_JOB,
  TASK_COMPILE_SOLIDITY_COMPILE_JOBS,
  TASK_COMPILE_SOLIDITY_COMPILE_SOLCJS,
  TASK_COMPILE_SOLIDITY_EMIT_ARTIFACTS,
  TASK_COMPILE_SOLIDITY_FILTER_COMPILATION_JOBS,
  TASK_COMPILE_SOLIDITY_GET_ARTIFACT_FROM_COMPILATION_OUTPUT,
  TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE,
  TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOBS,
  TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOBS_FAILURES_MESSAGE,
  TASK_COMPILE_SOLIDITY_GET_COMPILER_INPUT,
  TASK_COMPILE_SOLIDITY_GET_DEPENDENCY_GRAPH,
  TASK_COMPILE_SOLIDITY_GET_SOLCJS_PATH,
  TASK_COMPILE_SOLIDITY_GET_SOURCE_NAMES,
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
  TASK_COMPILE_SOLIDITY_HANDLE_COMPILATION_JOBS_FAILURES,
  TASK_COMPILE_SOLIDITY_LOG_COMPILATION_ERRORS,
  TASK_COMPILE_SOLIDITY_LOG_COMPILE_JOB_END,
  TASK_COMPILE_SOLIDITY_LOG_COMPILE_JOB_START,
  TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE,
  TASK_COMPILE_SOLIDITY_MERGE_COMPILATION_JOBS,
  TASK_COMPILE_SOLIDITY_RUN_SOLCJS,
} from "./task-names";
import * as taskTypes from "./types";
import {
  CompilationJob,
  CompilationJobCreationError,
  CompilationJobsCreationErrors,
  CompilationJobsCreationResult,
} from "./types";
import {
  getSolidityFilesCachePath,
  SolidityFilesCache,
} from "./utils/solidity-files-cache";

type ArtifactsEmittedPerFile = Array<{
  file: ResolvedFile;
  artifactsEmitted: string[];
}>;

type ArtifactsEmittedPerJob = Array<{
  compilationJob: CompilationJob;
  artifactsEmittedPerFile: ArtifactsEmittedPerFile;
}>;

function isConsoleLogError(error: any): boolean {
  return (
    error.type === "TypeError" &&
    typeof error.message === "string" &&
    error.message.includes("log") &&
    error.message.includes("type(library console)")
  );
}

const log = debug("buidler:core:tasks:compile");

export default function () {
  /**
   * Returns a list of absolute paths to all the solidity files in the project.
   * This list doesn't include dependencies, for example solidity files inside
   * node_modules.
   *
   * This is the right task to override to change how the solidity files of the
   * project are obtained.
   */
  internalTask(
    TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
    async (_, { config }): Promise<string[]> => {
      const paths = await glob(path.join(config.paths.sources, "**/*.sol"));

      return paths;
    }
  );

  /**
   * Receives a list of absolute paths and returns a list of source names
   * corresponding to each path. For example, receives
   * ["/home/user/project/contracts/Foo.sol"] and returns
   * ["contracts/Foo.sol"]. These source names will be used when the solc input
   * is generated.
   */
  internalTask(TASK_COMPILE_SOLIDITY_GET_SOURCE_NAMES)
    .addParam("sourcePaths", undefined, undefined, types.any)
    .setAction(
      async (
        { sourcePaths }: { sourcePaths: string[] },
        { config }
      ): Promise<string[]> => {
        const sourceNames = await Promise.all(
          sourcePaths.map((p) => localPathToSourceName(config.paths.root, p))
        );

        return sourceNames;
      }
    );

  /**
   * Receives a list of source names and returns a dependency graph. This task
   * is responsible for both resolving dependencies (like getting files from
   * node_modules) and generating the graph.
   */
  internalTask(TASK_COMPILE_SOLIDITY_GET_DEPENDENCY_GRAPH)
    .addParam("sourceNames", undefined, undefined, types.any)
    .addOptionalParam("solidityFilesCache", undefined, undefined, types.any)
    .setAction(
      async (
        {
          sourceNames,
          solidityFilesCache,
        }: { sourceNames: string[]; solidityFilesCache?: SolidityFilesCache },
        { config }
      ): Promise<taskTypes.DependencyGraph> => {
        const parser = new Parser(solidityFilesCache);
        const resolver = new Resolver(config.paths.root, parser);

        const resolvedFiles = await Promise.all(
          sourceNames.map((sn) => resolver.resolveSourceName(sn))
        );
        const dependencyGraph = await DependencyGraph.createFromResolvedFiles(
          resolver,
          resolvedFiles
        );

        return dependencyGraph;
      }
    );

  /**
   * Receives a dependency graph and a file in it, and returns the compilation
   * job for that file. The compilation job should have everything that is
   * necessary to compile that file: a compiler config to be used and a list of
   * files to use as input of the compilation.
   *
   * If the file cannot be compiled, a MatchingCompilerFailure should be
   * returned instead.
   *
   * This is the right task to override to change the compiler configuration.
   * For example, if you want to change the compiler settings when targetting
   * rinkeby, you could do something like this:
   *
   *   const compilationJob = await runSuper();
   *   if (config.network.name === 'rinkeby') {
   *     compilationJob.solidityConfig.settings = newSettings;
   *   }
   *   return compilationJob;
   *
   */
  internalTask(TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE)
    .addParam("dependencyGraph", undefined, undefined, types.any)
    .addParam("file", undefined, undefined, types.any)
    .addOptionalParam("solidityFilesCache", undefined, undefined, types.any)
    .setAction(
      async (
        {
          dependencyGraph,
          file,
        }: {
          dependencyGraph: taskTypes.DependencyGraph;
          file: ResolvedFile;
          solidityFilesCache?: SolidityFilesCache;
        },
        { config }
      ): Promise<CompilationJob | CompilationJobCreationError> => {
        return createCompilationJobFromFile(
          dependencyGraph,
          file,
          config.solidity
        );
      }
    );

  /**
   * Receives a dependency graph and returns a tuple with two arrays. The first
   * array is a list of CompilationJobsSuccess, where each item has a list of
   * compilation jobs. The second array is a list of CompilationJobsFailure,
   * where each item has a list of files that couldn't be compiled, grouped by
   * the reason for the failure.
   */
  internalTask(TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOBS)
    .addParam("dependencyGraph", undefined, undefined, types.any)
    .addOptionalParam("solidityFilesCache", undefined, undefined, types.any)
    .setAction(
      async (
        {
          dependencyGraph,
          solidityFilesCache,
        }: {
          dependencyGraph: taskTypes.DependencyGraph;
          solidityFilesCache?: SolidityFilesCache;
        },
        { run }
      ): Promise<CompilationJobsCreationResult> => {
        const connectedComponents = dependencyGraph.getConnectedComponents();

        log(
          `The dependency graph was dividied in '${connectedComponents.length}' connected components`
        );

        const compilationJobsCreationResults = await Promise.all(
          connectedComponents.map((graph) =>
            createCompilationJobsFromConnectedComponent(
              graph,
              (file: ResolvedFile) =>
                run(TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE, {
                  file,
                  dependencyGraph,
                  solidityFilesCache,
                })
            )
          )
        );

        const compilationJobsCreationResult = compilationJobsCreationResults.reduce(
          (acc, { jobs, errors }) => {
            acc.jobs = acc.jobs.concat(jobs);
            for (const [code, files] of unsafeObjectEntries(errors)) {
              acc.errors[code] = acc.errors[code] ?? [];
              acc.errors[code] = acc.errors[code]!.concat(files!);
            }
            return acc;
          },
          {
            jobs: [],
            errors: {},
          }
        );

        return compilationJobsCreationResult;
      }
    );

  /**
   * Receives a list of compilation jobs and returns a new list where some of
   * the compilation jobs might've been removed.
   *
   * This task can be overriden to change the way the cache is used, or to use
   * a different approach to filtering out compilation jobs.
   */
  internalTask(TASK_COMPILE_SOLIDITY_FILTER_COMPILATION_JOBS)
    .addParam("compilationJobs", undefined, undefined, types.any)
    .addParam("force", undefined, undefined, types.boolean)
    .addOptionalParam("solidityFilesCache", undefined, undefined, types.any)
    .setAction(
      async ({
        compilationJobs,
        force,
        solidityFilesCache,
      }: {
        compilationJobs: CompilationJob[];
        force: boolean;
        solidityFilesCache?: SolidityFilesCache;
      }): Promise<CompilationJob[]> => {
        assertBuidlerInvariant(
          solidityFilesCache !== undefined,
          "The implementation of this task needs a defined solidityFilesCache"
        );

        if (force) {
          log(`force flag enabled, not filtering`);
          return compilationJobs;
        }

        const neededCompilationJobs = compilationJobs.filter((job) =>
          needsCompilation(job, solidityFilesCache)
        );

        const jobsFilteredOutCount =
          compilationJobs.length - neededCompilationJobs.length;
        log(`'${jobsFilteredOutCount}' jobs were filtered out`);

        return neededCompilationJobs;
      }
    );

  /**
   * Receives a list of compilation jobs and returns a new list where some of
   * the jobs might've been merged.
   */
  internalTask(TASK_COMPILE_SOLIDITY_MERGE_COMPILATION_JOBS)
    .addParam("compilationJobs", undefined, undefined, types.any)
    .setAction(
      async ({
        compilationJobs,
      }: {
        compilationJobs: CompilationJob[];
      }): Promise<CompilationJob[]> => {
        return mergeCompilationJobsWithoutBug(compilationJobs);
      }
    );

  /**
   * Prints a message when there's nothing to compile.
   */
  internalTask(TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE)
    .addParam("quiet", undefined, undefined, types.boolean)
    .setAction(async ({ quiet }: { quiet: boolean }) => {
      if (!quiet) {
        console.log("Nothing to compile");
      }
    });

  /**
   * Receives a list of compilation jobs and sends each one to be compiled.
   */
  internalTask(TASK_COMPILE_SOLIDITY_COMPILE_JOBS)
    .addParam("compilationJobs", undefined, undefined, types.any)
    .addParam("quiet", undefined, undefined, types.boolean)
    .setAction(
      async (
        {
          compilationJobs,
          quiet,
        }: {
          compilationJobs: CompilationJob[];
          quiet: boolean;
        },
        { run }
      ): Promise<{ artifactsEmittedPerJob: ArtifactsEmittedPerJob }> => {
        if (compilationJobs.length === 0) {
          log(`No compilation jobs to compile`);
          await run(TASK_COMPILE_SOLIDITY_LOG_NOTHING_TO_COMPILE, { quiet });
          return { artifactsEmittedPerJob: [] };
        }

        const artifactsEmittedPerJob: ArtifactsEmittedPerJob = [];
        for (const compilationJob of compilationJobs) {
          const { artifactsEmittedPerFile } = await run(
            TASK_COMPILE_SOLIDITY_COMPILE_JOB,
            {
              compilationJob,
              quiet,
            }
          );

          artifactsEmittedPerJob.push({
            compilationJob,
            artifactsEmittedPerFile,
          });
        }

        return { artifactsEmittedPerJob };
      }
    );

  /**
   * Receives a compilation job and returns a SolcInput.
   *
   * It's not recommended to override this task to modify the solc
   * configuration, override
   * TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOB_FOR_FILE instead.
   */
  internalTask(TASK_COMPILE_SOLIDITY_GET_COMPILER_INPUT)
    .addParam("compilationJob", undefined, undefined, types.any)
    .setAction(
      async ({
        compilationJob,
      }: {
        compilationJob: CompilationJob;
      }): Promise<SolcInput> => {
        return getInputFromCompilationJob(compilationJob);
      }
    );

  /**
   * Receives a solc version and returns an absolute path to a solcjs module
   * for that version.
   */
  internalTask(TASK_COMPILE_SOLIDITY_GET_SOLCJS_PATH)
    .addParam("solcVersion", undefined, undefined, types.string)
    .setAction(
      async ({ solcVersion }: { solcVersion: string }): Promise<string> => {
        const { CompilerDownloader } = await import(
          "../internal/solidity/compiler/downloader"
        );

        const compilersCache = await getCompilersDir();
        const downloader = new CompilerDownloader(compilersCache);

        const solcJsPath = await downloader.getDownloadedCompilerPath(
          solcVersion
        );

        return solcJsPath;
      }
    );

  /**
   * Receives an absolute path to a solcjs module and the input to be compiled,
   * and return the generated output
   */
  internalTask(TASK_COMPILE_SOLIDITY_RUN_SOLCJS)
    .addParam("input", undefined, undefined, types.any)
    .addParam("solcJsPath", undefined, undefined, types.string)
    .setAction(
      async ({
        input,
        solcJsPath,
      }: {
        input: SolcInput;
        solcJsPath: string;
      }) => {
        const compiler = new Compiler(solcJsPath);

        const output = await compiler.compile(input);

        return output;
      }
    );

  /**
   * Receives a SolcInput and a solc version, compiles the input using solcjs,
   * and returns the generated output.
   *
   * This task can be overriden to change how solcjs is obtained or used.
   */
  internalTask(TASK_COMPILE_SOLIDITY_COMPILE_SOLCJS)
    .addParam("input", undefined, undefined, types.any)
    .addParam("solcVersion", undefined, undefined, types.string)
    .setAction(
      async (
        { input, solcVersion }: { input: SolcInput; solcVersion: string },
        { run }
      ) => {
        const solcJsPath: string = await run(
          TASK_COMPILE_SOLIDITY_GET_SOLCJS_PATH,
          {
            solcVersion,
          }
        );

        const output = await run(TASK_COMPILE_SOLIDITY_RUN_SOLCJS, {
          input,
          solcJsPath,
        });

        return output;
      }
    );

  /**
   * This task is just a proxy to the task that compiles solcjs.
   *
   * Override this to use a different task to compile a job.
   */
  internalTask(
    TASK_COMPILE_SOLIDITY_COMPILE,
    async (taskArgs: any, { run }) => {
      return run(TASK_COMPILE_SOLIDITY_COMPILE_SOLCJS, taskArgs);
    }
  );

  /**
   * Receives a compilation output and prints its errors and any other
   * information useful to the user.
   */
  internalTask(TASK_COMPILE_SOLIDITY_LOG_COMPILATION_ERRORS)
    .addParam("output", undefined, undefined, types.any)
    .addParam("quiet", undefined, undefined, types.boolean)
    .setAction(async ({ output }: { output: any; quiet: boolean }) => {
      if (output?.errors === undefined) {
        return;
      }

      for (const error of output.errors) {
        if (error.severity === "error") {
          console.error(chalk.red(error.formattedMessage));
        } else {
          console.warn(chalk.yellow(error.formattedMessage));
        }
      }

      const hasConsoleErrors = output.errors.some(isConsoleLogError);
      if (hasConsoleErrors) {
        console.error(
          chalk.red(
            `The console.log call you made isn’t supported. See https://buidler.dev/console-log for the list of supported methods.`
          )
        );
        console.log();
      }
    });

  /**
   * Receives a solc output and checks if there are errors. Throws if there are
   * errors.
   *
   * Override this task to avoid interrupting the compilation process if some
   * job has compilation errors.
   */
  internalTask(TASK_COMPILE_SOLIDITY_CHECK_ERRORS)
    .addParam("output", undefined, undefined, types.any)
    .addParam("quiet", undefined, undefined, types.boolean)
    .setAction(
      async ({ output, quiet }: { output: any; quiet: boolean }, { run }) => {
        await run(TASK_COMPILE_SOLIDITY_LOG_COMPILATION_ERRORS, {
          output,
          quiet,
        });

        const hasErrors =
          output.errors &&
          output.errors.some((x: any) => x.severity === "error");

        if (hasErrors || !output.contracts) {
          log(
            `Compilation failure. hasErrors='${hasErrors}' output.contracts='${!!output.contracts}'`
          );
          throw new BuidlerError(ERRORS.BUILTIN_TASKS.COMPILE_FAILURE);
        }
      }
    );

  /**
   * Saves to disk the artifacts for a compilation job. These artifacts
   * include the main artifacts, the dbg files, and the build info.
   */
  internalTask(TASK_COMPILE_SOLIDITY_EMIT_ARTIFACTS)
    .addParam("compilationJob", undefined, undefined, types.any)
    .addParam("input", undefined, undefined, types.any)
    .addParam("output", undefined, undefined, types.any)
    .setAction(
      async (
        {
          compilationJob,
          input,
          output,
        }: {
          compilationJob: CompilationJob;
          input: SolcInput;
          output: any;
        },
        { config, run }
      ): Promise<{
        artifactsEmittedPerFile: ArtifactsEmittedPerFile;
      }> => {
        const artifacts = new Artifacts(config.paths.artifacts);

        const pathToBuildInfo = await artifacts.saveBuildInfo(
          input,
          output,
          compilationJob.getSolcConfig().version
        );

        const artifactsEmittedPerFile: ArtifactsEmittedPerFile = [];
        for (const file of compilationJob.getResolvedFiles()) {
          log(`Emitting artifacts for file '${file.globalName}'`);
          if (!compilationJob.emitsArtifacts(file)) {
            continue;
          }

          const artifactsEmitted = [];
          for (const [contractName, contractOutput] of Object.entries(
            output.contracts?.[file.globalName] ?? {}
          )) {
            log(`Emitting artifact for contract '${contractName}'`);

            const artifact = await run(
              TASK_COMPILE_SOLIDITY_GET_ARTIFACT_FROM_COMPILATION_OUTPUT,
              {
                contractName,
                contractOutput,
              }
            );

            await artifacts.saveArtifactFiles(
              file.globalName,
              artifact,
              pathToBuildInfo
            );

            artifactsEmitted.push(artifact.contractName);
          }

          artifactsEmittedPerFile.push({
            file,
            artifactsEmitted,
          });
        }

        return { artifactsEmittedPerFile };
      }
    );

  /**
   * Generates the artifact for contract `contractName` given its compilation
   * output.
   */
  internalTask(TASK_COMPILE_SOLIDITY_GET_ARTIFACT_FROM_COMPILATION_OUTPUT)
    .addParam("contractName", undefined, undefined, types.string)
    .addParam("contractOutput", undefined, undefined, types.any)
    .setAction(
      async ({
        contractName,
        contractOutput,
      }: {
        contractName: string;
        contractOutput: any;
      }): Promise<any> => {
        return getArtifactFromContractOutput(contractName, contractOutput);
      }
    );

  /**
   * Prints a message before starting the compilation of a job.
   */
  internalTask(TASK_COMPILE_SOLIDITY_LOG_COMPILE_JOB_START)
    .addParam("compilationJob", undefined, undefined, types.any)
    .addParam("quiet", undefined, undefined, types.boolean)
    .setAction(
      async ({
        compilationJob,
        quiet,
      }: {
        compilationJob: CompilationJob;
        quiet: boolean;
      }) => {
        if (!quiet) {
          console.log(
            `Compiling with ${compilationJob.getSolcConfig().version}`
          );
        }
      }
    );

  /**
   * Prints a message after compiling a job.
   */
  internalTask(TASK_COMPILE_SOLIDITY_LOG_COMPILE_JOB_END)
    .addParam("compilationJob", undefined, undefined, types.any)
    .addParam("artifactsEmittedPerFile", undefined, undefined, types.any)
    .addParam("quiet", undefined, undefined, types.boolean)
    .setAction(
      async ({
        artifactsEmittedPerFile,
        quiet,
      }: {
        compilationJob: CompilationJob;
        artifactsEmittedPerFile: ArtifactsEmittedPerFile;
        quiet: boolean;
      }) => {
        if (quiet) {
          return;
        }

        const numberOfContracts = artifactsEmittedPerFile.length;
        console.log(
          "Compiled",
          numberOfContracts,
          pluralize(numberOfContracts, "contract"),
          "successfully"
        );
      }
    );

  /**
   * This is an orchestrator task that uses other internal tasks to compile a
   * compilation job.
   */
  internalTask(TASK_COMPILE_SOLIDITY_COMPILE_JOB)
    .addParam("compilationJob", undefined, undefined, types.any)
    .addParam("quiet", undefined, undefined, types.boolean)
    .setAction(
      async (
        {
          compilationJob,
          quiet,
        }: {
          compilationJob: CompilationJob;
          quiet: boolean;
        },
        { run }
      ): Promise<{ artifactsEmittedPerFile: ArtifactsEmittedPerFile }> => {
        log(
          `Compiling job with version '${
            compilationJob.getSolcConfig().version
          }'`
        );
        await run(TASK_COMPILE_SOLIDITY_LOG_COMPILE_JOB_START, {
          compilationJob,
          quiet,
        });

        const input: SolcInput = await run(
          TASK_COMPILE_SOLIDITY_GET_COMPILER_INPUT,
          {
            compilationJob,
          }
        );

        const output = await run(TASK_COMPILE_SOLIDITY_COMPILE, {
          solcVersion: compilationJob.getSolcConfig().version,
          input,
        });

        await run(TASK_COMPILE_SOLIDITY_CHECK_ERRORS, { output, quiet });

        const { artifactsEmittedPerFile } = await run(
          TASK_COMPILE_SOLIDITY_EMIT_ARTIFACTS,
          {
            compilationJob,
            input,
            output,
          }
        );

        await run(TASK_COMPILE_SOLIDITY_LOG_COMPILE_JOB_END, {
          compilationJob,
          artifactsEmittedPerFile,
          quiet,
        });

        return { artifactsEmittedPerFile };
      }
    );

  /**
   * Receives a list of CompilationJobsFailure and throws an error if it's not
   * empty.
   *
   * This task could be overriden to avoid interrupting the compilation if
   * there's some part of the project that can't be compiled.
   */
  internalTask(TASK_COMPILE_SOLIDITY_HANDLE_COMPILATION_JOBS_FAILURES)
    .addParam("compilationJobsCreationErrors", undefined, undefined, types.any)
    .setAction(
      async (
        {
          compilationJobsCreationErrors,
        }: {
          compilationJobsCreationErrors: CompilationJobsCreationErrors;
        },
        { run }
      ) => {
        const hasErrors = unsafeObjectEntries(
          compilationJobsCreationErrors
        ).some(([, errors]) => errors!.length > 0);

        if (hasErrors) {
          log(`There were errors creating the compilation jobs, throwing`);
          const errorMessage: string = await run(
            TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOBS_FAILURES_MESSAGE,
            { compilationJobsCreationErrors }
          );

          // TODO-HH throw a BuidlerError and show a better error message
          // tslint:disable only-buidler-error
          throw new Error(errorMessage);
        }
      }
    );

  /**
   * Receives a list of CompilationJobsFailure and returns an error message
   * that describes the failure.
   */
  internalTask(TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOBS_FAILURES_MESSAGE)
    .addParam("compilationJobsCreationErrors", undefined, undefined, types.any)
    .setAction(
      async ({
        compilationJobsCreationErrors: errors,
      }: {
        compilationJobsCreationErrors: CompilationJobsCreationErrors;
      }): Promise<string> => {
        let noCompatibleSolc: string[] = [];
        let incompatibleOverridenSolc: string[] = [];
        let importsIncompatibleFile: string[] = [];
        let other: string[] = [];

        for (const code of unsafeObjectKeys(errors)) {
          const files = errors[code];

          if (files === undefined) {
            continue;
          }

          if (
            code ===
            CompilationJobCreationError.NO_COMPATIBLE_SOLC_VERSION_FOUND
          ) {
            noCompatibleSolc = noCompatibleSolc.concat(files);
          } else if (
            code ===
            CompilationJobCreationError.INCOMPATIBLE_OVERRIDEN_SOLC_VERSION
          ) {
            incompatibleOverridenSolc = incompatibleOverridenSolc.concat(files);
          } else if (
            code === CompilationJobCreationError.IMPORTS_INCOMPATIBLE_FILE
          ) {
            importsIncompatibleFile = importsIncompatibleFile.concat(files);
          } else if (code === CompilationJobCreationError.OTHER_ERROR) {
            other = other.concat(files);
          } else {
            // add unrecognized errors to `other`
            other = other.concat(files);
          }
        }

        let errorMessage =
          "The project couldn't be compiled, see reasons below.\n\n";
        if (incompatibleOverridenSolc.length > 0) {
          errorMessage += `These files have overriden compilations that are incompatible with their version pragmas:

${incompatibleOverridenSolc.map((x) => `* ${x}`).join("\n")}

`;
        }
        if (noCompatibleSolc.length > 0) {
          errorMessage += `These files don't match any compiler in your config:

${noCompatibleSolc.map((x) => `* ${x}`).join("\n")}

`;
        }
        if (importsIncompatibleFile.length > 0) {
          errorMessage += `These files have imports with incompatible pragmas:

${importsIncompatibleFile.map((x) => `* ${x}`).join("\n")}

`;
        }
        if (other.length > 0) {
          errorMessage += `These files and its dependencies cannot be compiled with your config:

${other.map((x) => `* ${x}`).join("\n")}

`;
        }

        return errorMessage;
      }
    );

  /**
   * Main task for compiling the solidity files in the project.
   *
   * The main responsibility of this task is to orchestrate and connect most of
   * the internal tasks related to compiling solidity.
   */
  internalTask(TASK_COMPILE_SOLIDITY)
    .addParam("force", undefined, undefined, types.boolean)
    .addParam("quiet", undefined, undefined, types.boolean)
    .setAction(
      async (
        { force, quiet }: { force: boolean; quiet: boolean },
        { config, run }
      ) => {
        const sourcePaths: string[] = await run(
          TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS
        );

        const sourceNames: string[] = await run(
          TASK_COMPILE_SOLIDITY_GET_SOURCE_NAMES,
          {
            sourcePaths,
          }
        );

        const solidityFilesCachePath = getSolidityFilesCachePath(config.paths);
        let solidityFilesCache = await SolidityFilesCache.readFromFile(
          solidityFilesCachePath
        );

        const dependencyGraph: taskTypes.DependencyGraph = await run(
          TASK_COMPILE_SOLIDITY_GET_DEPENDENCY_GRAPH,
          { sourceNames, solidityFilesCache }
        );

        solidityFilesCache = await invalidateCacheMissingArtifacts(
          solidityFilesCache,
          config.paths.artifacts,
          dependencyGraph.getResolvedFiles()
        );

        const compilationJobsCreationResult: CompilationJobsCreationResult = await run(
          TASK_COMPILE_SOLIDITY_GET_COMPILATION_JOBS,
          {
            dependencyGraph,
            solidityFilesCache,
          }
        );

        await run(TASK_COMPILE_SOLIDITY_HANDLE_COMPILATION_JOBS_FAILURES, {
          compilationJobsCreationErrors: compilationJobsCreationResult.errors,
        });

        const compilationJobs = compilationJobsCreationResult.jobs;

        const filteredCompilationJobs: CompilationJob[] = await run(
          TASK_COMPILE_SOLIDITY_FILTER_COMPILATION_JOBS,
          { compilationJobs, force, solidityFilesCache }
        );

        const mergedCompilationJobs: CompilationJob[] = await run(
          TASK_COMPILE_SOLIDITY_MERGE_COMPILATION_JOBS,
          { compilationJobs: filteredCompilationJobs }
        );

        const {
          artifactsEmittedPerJob,
        }: { artifactsEmittedPerJob: ArtifactsEmittedPerJob } = await run(
          TASK_COMPILE_SOLIDITY_COMPILE_JOBS,
          {
            compilationJobs: mergedCompilationJobs,
            quiet,
          }
        );

        // update cache using the information about the emitted artifacts
        for (const {
          compilationJob: compilationJob,
          artifactsEmittedPerFile: artifactsEmittedPerFile,
        } of artifactsEmittedPerJob) {
          for (const { file, artifactsEmitted } of artifactsEmittedPerFile) {
            solidityFilesCache.addFile(file.absolutePath, {
              lastModificationDate: file.lastModificationDate.valueOf(),
              globalName: file.globalName,
              solcConfig: compilationJob.getSolcConfig(),
              imports: file.content.imports,
              versionPragmas: file.content.versionPragmas,
              artifacts: artifactsEmitted,
            });
          }
        }

        const allArtifactsEmittedPerFile = solidityFilesCache.getEntries();

        const artifacts = new Artifacts(config.paths.artifacts);
        await artifacts.removeObsoleteArtifacts(allArtifactsEmittedPerFile);
        await artifacts.removeObsoleteBuildInfos();

        await solidityFilesCache.writeToFile(solidityFilesCachePath);
      }
    );

  /**
   * Returns a list of compilation tasks.
   *
   * This is the task to override to add support for other languages.
   */
  internalTask(
    TASK_COMPILE_GET_COMPILATION_TASKS,
    async (): Promise<string[]> => {
      return [TASK_COMPILE_SOLIDITY];
    }
  );

  /**
   * Main compile task.
   *
   * This is a meta-task that just gets all the compilation tasks and runs them.
   * Right now there's only a "compile solidity" task.
   */
  task(TASK_COMPILE, "Compiles the entire project, building all artifacts")
    .addFlag("force", "Force compilation ignoring cache")
    .addFlag("quiet", "Suppress all console output")
    .setAction(async (compilationArgs: any, { run }) => {
      const compilationTasks: string[] = await run(
        TASK_COMPILE_GET_COMPILATION_TASKS
      );

      for (const compilationTask of compilationTasks) {
        await run(compilationTask, compilationArgs);
      }
    });
}

/**
 * If a file is present in the cache, but some of its artifacts is missing on
 * disk, we remove it from the cache to force it to be recompiled.
 */
async function invalidateCacheMissingArtifacts(
  solidityFilesCache: SolidityFilesCache,
  artifactsPath: string,
  resolvedFiles: ResolvedFile[]
): Promise<SolidityFilesCache> {
  for (const file of resolvedFiles) {
    const artifacts = new Artifacts(artifactsPath);

    const cacheEntry = solidityFilesCache.getEntry(file.absolutePath);

    if (cacheEntry === undefined) {
      continue;
    }

    const { artifacts: artifactsEmitted } = cacheEntry;

    for (const artifactEmitted of artifactsEmitted) {
      const artifactExists = await artifacts.artifactExists(
        file.globalName,
        artifactEmitted
      );
      if (!artifactExists) {
        log(
          `Invalidate cache for '${file.absolutePath}' because artifact '${artifactEmitted}' doesn't exist`
        );
        solidityFilesCache.removeEntry(file.absolutePath);
        break;
      }
    }
  }

  return solidityFilesCache;
}

/**
 * Checks if the given compilation job needs to be done.
 */
function needsCompilation(
  job: taskTypes.CompilationJob,
  cache: SolidityFilesCache
): boolean {
  for (const file of job.getResolvedFiles()) {
    const hasChanged = cache.hasFileChanged(
      file.absolutePath,
      file.lastModificationDate,
      // we only check if the solcConfig is different for files that
      // emit artifacts
      job.emitsArtifacts(file) ? job.getSolcConfig() : undefined
    );

    if (hasChanged) {
      return true;
    }
  }

  return false;
}
