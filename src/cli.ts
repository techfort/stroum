#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Validator } from './validator';
import { Transpiler } from './transpiler';
import { ModuleResolver } from './module-resolver';

const VERSION = '1.0.0';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(text: string, color: keyof typeof colors): string {
  if (process.env.NO_COLOR) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

function showHelp() {
  console.log(`
${colorize('Stroum', 'cyan')} ${colorize(`v${VERSION}`, 'bright')}
${colorize('A functional, pipe-first, stream-oriented programming language', 'blue')}

${colorize('USAGE:', 'bright')}
  stroum <command> [options]

${colorize('COMMANDS:', 'bright')}
  ${colorize('compile', 'green')} <file.stm>     Transpile Stroum to TypeScript
  ${colorize('run', 'green')} <file.stm>         Compile and execute a Stroum program
  ${colorize('init', 'green')} [name]            Initialize a new Stroum project
  ${colorize('version', 'green')}                Show version information
  ${colorize('help', 'green')}                   Show this help message

${colorize('COMPILE OPTIONS:', 'bright')}
  -o, --output <file>     Specify output file (default: input.ts)
  --ast                   Dump AST as JSON instead of compiling
  --no-stdlib             Disable automatic stdlib import

${colorize('MODULE SYSTEM:', 'bright')}
  i:core                  Import stdlib module (auto-imported by default)
  i:"./file.stm"          Import local module
  i:core add, mul         Selective imports
  i:core as c             Qualified imports (use as c:add, c:mul)

${colorize('EXAMPLES:', 'bright')}
  stroum init my-project
  stroum compile app.stm
  stroum compile app.stm -o build/app.ts
  stroum compile app.stm --ast
  stroum compile app.stm --no-stdlib
  stroum run examples/demo.stm

${colorize('DOCUMENTATION:', 'bright')}
  README.md               Getting started guide
  PHASE5-COMPLETE.md      CLI documentation
  PHASE4-COMPLETE.md      Transpiler documentation
  RUNNER.md               Execution guide
`);
}

function showVersion() {
  console.log(`${colorize('Stroum', 'cyan')} ${colorize(`v${VERSION}`, 'bright')}`);
  console.log(`Node ${process.version}`);
}

function compileCommand(args: string[]) {
    const inputFile = args[0];
    
    if (!inputFile) {
      console.error(colorize('Error:', 'red') + ' input file required');
      console.error('Usage: stroum compile <input.stm> [-o <output.ts>] [--ast] [--no-stdlib]');
      process.exit(1);
    }

    let outputFile: string | null = null;
    let dumpAst = false;
    let useStdlib = true;

    // Parse flags
    for (let i = 1; i < args.length; i++) {
      if ((args[i] === '-o' || args[i] === '--output') && i + 1 < args.length) {
        outputFile = args[i + 1];
        i++;
      } else if (args[i] === '--ast') {
        dumpAst = true;
      } else if (args[i] === '--no-stdlib') {
        useStdlib = false;
      }
    }

    try {
      const absoluteInputFile = path.resolve(inputFile);
      
      // Determine stdlib path
      const stdlibPath = useStdlib ? path.join(__dirname, '..', 'stdlib') : undefined;
      
      // Phase 1-2: Resolve all modules and parse them
      const resolver = new ModuleResolver(stdlibPath);
      resolver.loadModule(absoluteInputFile); // Load main file and all dependencies
      const modules = resolver.getModulesInOrder(); // Get all modules in dependency order
      
      if (dumpAst) {
        // Dump AST for all modules
        const allAsts = modules.map(mod => ({
          path: mod.filePath,
          ast: mod.module
        }));
        console.log(JSON.stringify(allAsts, null, 2));
        process.exit(0);
      }

      // Phase 3: Validation (validates all modules together)
      const validator = new Validator(stdlibPath);
      let allIssues = [];
      
      for (const resolvedModule of modules) {
        const issues = validator.validate(resolvedModule.module);
        allIssues.push(...issues.map(issue => ({ ...issue, file: resolvedModule.filePath })));
      }
      
      // Report errors and warnings
      const errors = allIssues.filter(i => i.type === 'error');
      const warnings = allIssues.filter(i => i.type === 'warning');
      
      for (const warning of warnings) {
        const location = warning.file ? `${path.relative(process.cwd(), warning.file)}:` : '';
        console.error(colorize('[warning]', 'yellow') + ` ${location}line ${warning.location.line}, col ${warning.location.column}: ${warning.message}`);
      }
      
      for (const error of errors) {
        const location = error.file ? `${path.relative(process.cwd(), error.file)}:` : '';
        console.error(colorize('[error]', 'red') + ` ${location}line ${error.location.line}, col ${error.location.column}: ${error.message}`);
      }
      
      if (errors.length > 0) {
        console.error(colorize(`Validation failed with ${errors.length} error(s)`, 'red'));
        process.exit(1);
      }

      // Phase 4: Transpilation
      const transpiler = new Transpiler(stdlibPath);
      
      // Determine output file for the main module
      if (!outputFile) {
        outputFile = inputFile.replace(/\.stm$/, '.ts');
      }
      
      // Transpile all modules
      for (const resolvedModule of modules) {
        const tsCode = transpiler.transpile(resolvedModule.module, resolvedModule.filePath);
        
        // Use custom output file for main module, default location for imports
        let moduleOutputFile: string;
        if (resolvedModule.filePath === absoluteInputFile) {
          // Main module - use the specified output file
          moduleOutputFile = outputFile;
        } else {
          // Imported module - write next to source
          moduleOutputFile = resolvedModule.filePath.replace(/\.stm$/, '.ts');
        }
        
        fs.writeFileSync(moduleOutputFile, tsCode);
      }
      
      // Emit runtime file in the same directory as the main output
      const outputDir = path.dirname(path.resolve(outputFile));
      Transpiler.emitRuntime(outputDir);
      
      console.log(colorize('✓', 'green') + ' Transpilation successful');
      console.log(`  Main output: ${colorize(outputFile, 'cyan')}`);
      if (modules.length > 1) {
        console.log(`  ${modules.length - 1} imported module(s) compiled`);
      }
      console.log(`  Runtime: ${colorize(path.join(outputDir, 'stroum-runtime.ts'), 'cyan')}`);
      if (warnings.length > 0) {
        console.log(colorize(`  ${warnings.length} warning(s) reported`, 'yellow'));
      }
      
    } catch (error: any) {
      console.error(colorize('Error:', 'red'), error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
}

function runCommand(args: string[]) {
  const inputFile = args[0];

  if (!inputFile) {
    console.error(colorize('Error:', 'red') + ' input file required');
    console.error('Usage: stroum run <input.stm>');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(colorize('Error:', 'red') + ` file not found: ${inputFile}`);
    process.exit(1);
  }

  const os = require('os');
  const absoluteInputFile = path.resolve(inputFile);
  const basename = path.basename(inputFile, '.stm');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stroum-'));

  // Cleanup on exit
  const cleanup = () => { try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {} };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  console.log(colorize(`🚀 Executing Stroum file: ${inputFile}`, 'cyan'));
  console.log('');

  // Step 1: Transpile to temp dir
  console.log('📝 Transpiling to TypeScript...');
  const stdlibPath = path.join(__dirname, '..', 'stdlib');
  const outputTs = path.join(tempDir, `${basename}.ts`);

  try {
    const resolver = new ModuleResolver(stdlibPath);
    resolver.loadModule(absoluteInputFile);
    const modules = resolver.getModulesInOrder();

    const validator = new Validator(stdlibPath);
    const allIssues: any[] = [];
    for (const mod of modules) {
      const issues = validator.validate(mod.module, mod.filePath);
      allIssues.push(...issues.map((i: any) => ({ ...i, file: mod.filePath })));
    }

    const errors = allIssues.filter((i: any) => i.type === 'error');
    const warnings = allIssues.filter((i: any) => i.type === 'warning');

    for (const w of warnings) {
      const loc = w.file ? `${path.relative(process.cwd(), w.file)}:` : '';
      console.error(colorize('[warning]', 'yellow') + ` ${loc}line ${w.location.line}, col ${w.location.column}: ${w.message}`);
    }
    for (const e of errors) {
      const loc = e.file ? `${path.relative(process.cwd(), e.file)}:` : '';
      console.error(colorize('[error]', 'red') + ` ${loc}line ${e.location.line}, col ${e.location.column}: ${e.message}`);
    }
    if (errors.length > 0) {
      console.error(colorize(`Validation failed with ${errors.length} error(s)`, 'red'));
      cleanup();
      process.exit(1);
    }

    const transpiler = new Transpiler(stdlibPath);
    for (const mod of modules) {
      const tsCode = transpiler.transpile(mod.module, mod.filePath);
      const outFile = mod.filePath === absoluteInputFile
        ? outputTs
        : path.join(tempDir, path.basename(mod.filePath, '.stm') + '.ts');
      fs.writeFileSync(outFile, tsCode);
    }
    Transpiler.emitRuntime(tempDir);

    console.log(colorize('✓', 'green') + ' Transpilation successful');
    if (modules.length > 1) console.log(`  ${modules.length - 1} imported module(s) compiled`);
    console.log(`  Runtime: ${colorize(path.join(tempDir, 'stroum-runtime.ts'), 'cyan')}`);
  } catch (err: any) {
    console.error(colorize('Error:', 'red'), err.message);
    cleanup();
    process.exit(1);
  }

  // Step 2: Compile TS → JS
  console.log('📝 Compiling to JavaScript...');
  const tscPath = path.join(__dirname, '..', 'node_modules', '.bin', 'tsc');
  const tscArgs = [
    outputTs,
    path.join(tempDir, 'stroum-runtime.ts'),
    path.join(tempDir, 'stdlib-runtime.ts'),
    '--outDir', tempDir,
    '--module', 'commonjs',
    '--target', 'es2020',
    '--moduleResolution', 'node',
    '--esModuleInterop', 'true',
    '--skipLibCheck',
  ];

  const tscResult = require('child_process').spawnSync(tscPath, tscArgs, {
    cwd: __dirname,
    encoding: 'utf-8',
  });
  if (tscResult.stdout) process.stderr.write(tscResult.stdout);
  if (tscResult.stderr) process.stderr.write(tscResult.stderr);

  // Step 3: Execute
  console.log('📝 Executing...');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    STROUM PROGRAM OUTPUT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const outputJs = path.join(tempDir, `${basename}.js`);
  if (!fs.existsSync(outputJs)) {
    console.error(colorize('Error:', 'red') + ' Compilation produced no output. Check TypeScript errors above.');
    cleanup();
    process.exit(1);
  }

  // Run with the original cwd so relative paths in the program resolve correctly.
  // Module imports (require('./stroum-runtime')) resolve relative to the .js file, not cwd.
  const nodeResult = spawn('node', [outputJs], { stdio: 'inherit' });
  nodeResult.on('exit', (code) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    if (code === 0) {
      console.log(colorize('✅ Execution complete!', 'green'));
    } else {
      console.log(colorize(`❌ Process exited with code ${code}`, 'red'));
    }
    cleanup();
    process.exit(code || 0);
  });
  nodeResult.on('error', (err) => {
    console.error(colorize('Error:', 'red'), err.message);
    cleanup();
    process.exit(1);
  });
}

function initCommand(args: string[]) {
  const projectName = args[0] || 'my-stroum-project';
  const projectPath = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(projectPath)) {
    console.error(colorize('Error:', 'red') + ` directory already exists: ${projectName}`);
    process.exit(1);
  }

  console.log(colorize('✨ Creating new Stroum project:', 'cyan') + ` ${projectName}`);
  
  // Create project directory
  fs.mkdirSync(projectPath);
  fs.mkdirSync(path.join(projectPath, 'src'));
  
  // Create a sample Stroum file
  const sampleStm = `-- Hello World in Stroum
-- A simple example demonstrating pipe operations

f:double x => multiply(x, 2)

f:add a b => plus(a, b)

f:compute => add(double(5), double(3))

-- Execute and print result
compute()
`;

  fs.writeFileSync(path.join(projectPath, 'src', 'hello.stm'), sampleStm);
  
  // Create README
  const readme = `# ${projectName}

A Stroum project

## Getting Started

Compile your Stroum files:

\`\`\`bash
stroum compile src/hello.stm
\`\`\`

Run directly:

\`\`\`bash
stroum run src/hello.stm
\`\`\`

## Learn More

- [Stroum Documentation](../README.md)
- [Language Specification](../PHASE4-COMPLETE.md)
`;

  fs.writeFileSync(path.join(projectPath, 'README.md'), readme);
  
  console.log();
  console.log(colorize('✓', 'green') + ' Created project structure:');
  console.log(`  ${projectName}/`);
  console.log(`  ├── src/`);
  console.log(`  │   └── hello.stm`);
  console.log(`  └── README.md`);
  console.log();
  console.log('Next steps:');
  console.log(`  ${colorize('cd', 'cyan')} ${projectName}`);
  console.log(`  ${colorize('stroum run', 'cyan')} src/hello.stm`);
  console.log();
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);
  
  switch (command) {
    case 'compile':
      compileCommand(commandArgs);
      break;
    
    case 'run':
      runCommand(commandArgs);
      break;
    
    case 'init':
      initCommand(commandArgs);
      break;
    
    case 'version':
    case '-v':
    case '--version':
      showVersion();
      break;
    
    case 'help':
    case '-h':
    case '--help':
      showHelp();
      break;
    
    default:
      console.error(colorize('Error:', 'red') + ` unknown command: ${command}`);
      console.error('Run ' + colorize('stroum help', 'cyan') + ' for usage information');
      process.exit(1);
  }
}

main();
