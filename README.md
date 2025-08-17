# fzf-import-cli

CLI tool for finding and importing JavaScript/TypeScript modules when LSP fails to identify them.

## Installation

```bash
npm install -g fzf-import-cli
```

## Usage

```bash
# Interactive mode - search and select imports
fzf-import /path/to/file.js

# Direct search mode - search for specific keyword
fzf-import /path/to/file.js "MyComponent"
```

## Requirements

- [ripgrep](https://github.com/BurntSushi/ripgrep)
- [fzf](https://github.com/junegunn/fzf)

## Supported Languages

- JavaScript
- TypeScript