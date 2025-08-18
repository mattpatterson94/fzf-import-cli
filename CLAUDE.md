# fzf-import-cli

## Project Overview

A CLI tool for finding and importing JavaScript/TypeScript modules when LSP fails to identify them in your codebase. This is a standalone version of the [fzf-lua-import.nvim](https://github.com/mattpatterson94/fzf-lua-import.nvim) Neovim plugin.

## Key Features

- **Interactive Mode**: `fzf-import file.ts` - Use fzf to select from available imports
- **Keyword Search**: `fzf-import file.ts "React"` - Search for specific keyword in imports
- **Smart Import Placement**: Adds imports after existing imports, before code
- **Duplicate Detection**: Prevents re-adding existing imports
- **Project-Aware Search**: Searches from nearest package.json directory
- **Multi-Language Support**: TypeScript, JavaScript, TSX, JSX files

## Architecture

### Core Components

- **`src/cli.ts`**: CLI argument parsing and main entry point
- **`src/fzf-import.ts`**: Main logic for search and import functionality
- **`src/config.ts`**: File type configurations and regex patterns (ported from Lua)
- **`src/utils.ts`**: Utility functions for file operations and project detection

### Key Functions

- `Utils.findProjectRoot()`: Walks up directories to find nearest package.json
- `FzfImport.searchImports()`: Uses ripgrep to find import statements
- `FzfImport.selectWithFzf()`: Interactive selection using system fzf
- `Utils.addImportToFile()`: Smart import insertion with proper placement

## Dependencies

### Runtime
- **ripgrep** (`rg`): Fast text search for finding import statements
- **fzf**: Fuzzy finder for interactive selection
- **commander**: CLI argument parsing

### Development
- **TypeScript**: Primary language
- **ts-node**: Development server
- **@types/node**: Node.js type definitions

## Development Commands

```bash
# Install dependencies
pnpm install

# Development mode
pnpm run dev

# Build project
pnpm run build

# Type checking
pnpm run type-check

# Run built CLI
./dist/cli.js [options] <file> [keyword]
```

## Search Logic

1. **Pattern Matching**: Uses regex patterns to match import statements:
   ```regex
   ^import.*<keyword>
   ```

2. **File Types**: Searches `.ts`, `.tsx`, `.js`, `.jsx` files

3. **Project Scope**: Starts search from nearest `package.json` directory

4. **Exclusions**: Ignores lock files and follows `.gitignore` patterns

## Import Placement Strategy

1. Skip comments and empty lines at top of file
2. Find existing import statements
3. Insert new import after last existing import
4. If no imports exist, insert at first non-comment line

## Testing

Basic functionality testing:
- Keyword search: `./dist/cli.js test-file.ts "React"`
- Interactive mode: `./dist/cli.js test-file.ts`
- Duplicate detection: Run same command twice
- Debug mode: Add `--debug` flag for verbose output

## Original Inspiration

Ported from [fzf-lua-import.nvim](../fzf-lua-import.nvim) Neovim plugin:
- Same regex patterns and file detection logic
- Similar workflow but uses system fzf instead of fzf-lua
- Maintains compatibility with original use cases

## Project Structure

```
fzf-import-cli/
├── src/
│   ├── cli.ts          # Main CLI entry point
│   ├── fzf-import.ts   # Core import search/add logic
│   ├── config.ts       # File type configs & patterns
│   └── utils.ts        # File operations & project detection
├── dist/               # Built JavaScript (ignored in git)
├── package.json        # Dependencies & scripts
├── tsconfig.json       # TypeScript configuration
├── README.md           # User documentation
└── CLAUDE.md          # This file - development context
```

## Future Enhancement Ideas

- [ ] Search actual npm packages in node_modules
- [ ] Support for ES6 modules and CommonJS
- [ ] Custom regex patterns via config file
- [ ] Integration with TypeScript path mapping
- [ ] Cache for faster repeated searches
- [ ] Support for more file types (Vue, Svelte, etc.)

## Common Issues

- **No imports found**: Check if ripgrep and fzf are installed
- **Wrong search scope**: Verify package.json exists in project
- **Import placement**: Tool respects existing import order and comments