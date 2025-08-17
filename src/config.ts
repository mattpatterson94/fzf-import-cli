export interface FileTypeConfig {
  // Regex pattern for matching import statements
  regex: string;
  // File extensions to search
  glob: string[];
}

export interface RipgrepOptions {
  // Additional ripgrep options
  extraArgs: string[];
  // Whether to show column numbers
  column: boolean;
  // Whether to show line numbers
  lineNumber: boolean;
}

export class Config {
  // File type configurations (ported from config.lua)
  static readonly fileTypes: Record<string, FileTypeConfig> = {
    typescript: {
      // Matches import statements like:
      // import { MyModule } from 'lib/my_module';
      // import * as mobx from 'mobx'
      // import styles from "myfile.css"
      // Excludes relative paths like "./myfile.css"
      regex: "^import\\s*(type\\s+)?(\\*\\s*as)?(\\*?\\s*\\{?[^}]*%s[^}]*\\}?|\\*?\\s*%s)\\s*from\\s*[\\\"\\']@?\\/?\\w",
      glob: ['ts', 'tsx', 'js', 'jsx']
    },
    typescriptreact: {
      regex: "^import\\s*(type\\s+)?(\\*\\s*as)?(\\*?\\s*\\{?[^}]*%s[^}]*\\}?|\\*?\\s*%s)\\s*from\\s*[\\\"\\']@?\\/?\\w",
      glob: ['ts', 'tsx', 'js', 'jsx']
    },
    javascript: {
      regex: "^import\\s*(type\\s+)?(\\*\\s*as)?(\\*?\\s*\\{?[^}]*%s[^}]*\\}?|\\*?\\s*%s)\\s*from\\s*[\\\"\\']@?\\/?\\w",
      glob: ['ts', 'tsx', 'js', 'jsx']
    },
    javascriptreact: {
      regex: "^import\\s*(type\\s+)?(\\*\\s*as)?(\\*?\\s*\\{?[^}]*%s[^}]*\\}?|\\*?\\s*%s)\\s*from\\s*[\\\"\\']@?\\/?\\w",
      glob: ['ts', 'tsx', 'js', 'jsx']
    }
  };

  // Default ripgrep options (ported from fzf-lua-import.lua)
  static readonly ripgrepOptions: RipgrepOptions = {
    extraArgs: [
      '--column',
      '--no-filename',
      '-n',
      '--no-heading',
      '--color=never',
      '--smart-case',
      '--no-column',
      '--no-line-number'
    ],
    column: false,
    lineNumber: false
  };

  /**
   * Get file type configuration for a given file type
   */
  static getFileTypeConfig(fileType: string): FileTypeConfig | null {
    return this.fileTypes[fileType] || null;
  }

  /**
   * Create ripgrep search pattern for a given keyword and file type
   */
  static createSearchPattern(keyword: string, fileType: string): { pattern: string; glob: string } | null {
    const config = this.getFileTypeConfig(fileType);
    if (!config) {
      return null;
    }

    // For now, use a simpler pattern to test
    const pattern = `^import.*${keyword}`;
    const glob = `--glob '*.{${config.glob.join(',')}}'`;

    return { pattern, glob };
  }
}