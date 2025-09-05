# fzf-import-cli

CLI tool for finding and importing JavaScript/TypeScript modules when LSP fails to identify them.

## Installation

### Global Installation

You can install the tool globally to use it from anywhere:

```bash
# Using npm
npm install -g fzf-import-cli

# Using pnpm
pnpm install -g fzf-import-cli

# Using yarn
yarn global add fzf-import-cli
```

### Local Development

Clone the repository and install dependencies:

```bash
# Clone the repo
git clone https://github.com/your-username/fzf-import-cli.git
cd fzf-import-cli

# Install dependencies
pnpm install

# Build the tool
pnpm run build

# Link it globally (for development)
pnpm link --global
```

## Usage

```bash
# Interactive mode - search and select imports
fzf-import /path/to/file.js

# Direct search mode - search for specific keyword
fzf-import /path/to/file.js "MyComponent"

# Position-based search - extract symbol at specific position and search
fzf-import /path/to/file.js:15:8

# Debug mode - show detailed debug information
fzf-import /path/to/file.js --debug
```

### Command Line Options

```
Usage: fzf-import [options] <file> [keyword]

Arguments:
  file        target file to add imports to (supports file:row:col format)
  keyword     keyword to search for (optional - if not provided, interactive mode is used)

Options:
  -d, --debug  enable debug output
  -h, --help   display help for command
```

### Features

- **Interactive Mode**: Fuzzy search through all imports in your codebase
- **Keyword Search**: Find imports related to a specific keyword
- **Position-Based**: Extract symbol at cursor position and find matching imports
- **Real-Time Streaming**: Results appear instantly as they're found
- **Smart Import Placement**: Adds imports at the top of import blocks
- **Duplicate Detection**: Prevents adding imports that already exist
- **Relevance Sorting**: Prioritizes most relevant imports first (single imports get higher priority)
- **Project-Aware**: Searches from the nearest package.json directory

## Requirements

- [ripgrep](https://github.com/BurntSushi/ripgrep)
- [fzf](https://github.com/junegunn/fzf)

## Supported Languages

- JavaScript
- TypeScript