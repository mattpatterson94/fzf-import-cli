import { spawn } from 'child_process';
import { Utils } from './utils';
import { Config } from './config';
import * as path from 'path';

export interface FzfImportOptions {
  debug?: boolean;
}

export class FzfImport {
  private options: FzfImportOptions;

  constructor(options: FzfImportOptions = {}) {
    this.options = options;
  }

  /**
   * Search for imports using a specific keyword and add to file
   */
  async searchAndImport(filePath: string, keyword: string): Promise<void> {
    const fileType = Utils.getFileType(filePath);
    const searchResult = Config.createSearchPattern(keyword, fileType);

    if (!searchResult) {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    this.log(`Searching for imports containing: ${keyword}`);
    this.log(`File type: ${fileType}`);
    this.log(`Pattern: ${searchResult.pattern}`);

    const imports = await this.searchImports(searchResult.pattern, searchResult.glob, filePath);
    
    if (imports.length === 0) {
      console.log('No imports found matching the keyword.');
      return;
    }

    // If only one result, use it directly
    if (imports.length === 1) {
      await this.addImportToFile(filePath, imports[0]);
      return;
    }

    // Multiple results, use fzf for selection
    const selected = await this.selectWithFzf(imports, `Select import for "${keyword}"`);
    if (selected) {
      await this.addImportToFile(filePath, selected);
    }
  }

  /**
   * Interactive import selection
   */
  async interactiveImport(filePath: string): Promise<void> {
    const fileType = Utils.getFileType(filePath);
    const config = Config.getFileTypeConfig(fileType);

    if (!config) {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    this.log(`Interactive mode for: ${filePath}`);
    this.log(`File type: ${fileType}`);

    // Search for all import statements (remove %s placeholders for general search)
    const pattern = config.regex.replace(/%s/g, '\\w+');
    const glob = `--glob '*.{${config.glob.join(',')}}'`;

    const imports = await this.searchImports(pattern, glob, filePath);
    
    if (imports.length === 0) {
      console.log('No imports found in the project.');
      return;
    }

    const selected = await this.selectWithFzf(imports, 'Select import to add');
    if (selected) {
      await this.addImportToFile(filePath, selected);
    }
  }

  /**
   * Search for imports using ripgrep
   */
  private async searchImports(pattern: string, glob: string, targetFile: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const cwd = Utils.findProjectRoot(targetFile);
      const args = [
        pattern,
        ...Config.ripgrepOptions.extraArgs,
        '--glob', `*.{ts,tsx,js,jsx}`, // Direct glob pattern without quotes
        '--type-not', 'lock', // Exclude lock files
        '.'
      ];

      this.log(`Running: rg ${args.join(' ')}`);
      this.log(`Project root: ${cwd}`);

      const rg = spawn('rg', args, { cwd });
      let stdout = '';
      let stderr = '';

      rg.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      rg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      rg.on('close', (code) => {
        if (code === 1) {
          // ripgrep returns 1 when no matches found
          resolve([]);
          return;
        }

        if (code !== 0) {
          reject(new Error(`ripgrep failed with code ${code}: ${stderr}`));
          return;
        }

        // Parse ripgrep output and deduplicate
        const lines = stdout.trim().split('\n').filter(line => line.length > 0);
        const uniqueImports = [...new Set(lines)];
        
        this.log(`Found ${uniqueImports.length} unique imports`);
        resolve(uniqueImports);
      });

      rg.on('error', (err) => {
        reject(new Error(`Failed to start ripgrep: ${err.message}`));
      });
    });
  }

  /**
   * Use fzf to select from a list of options
   */
  private async selectWithFzf(options: string[], prompt: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const fzf = spawn('fzf', [
        '--prompt', `${prompt}> `,
        '--height', '40%',
        '--layout', 'reverse',
        '--border'
      ]);

      let stdout = '';
      let stderr = '';

      // Provide options to fzf via stdin
      fzf.stdin.write(options.join('\n'));
      fzf.stdin.end();

      fzf.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      fzf.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      fzf.on('close', (code) => {
        if (code === 130) {
          // User cancelled (Ctrl+C)
          console.log('Selection cancelled.');
          resolve(null);
          return;
        }

        if (code !== 0) {
          reject(new Error(`fzf failed with code ${code}: ${stderr}`));
          return;
        }

        const selected = stdout.trim();
        resolve(selected || null);
      });

      fzf.on('error', (err) => {
        reject(new Error(`Failed to start fzf: ${err.message}`));
      });
    });
  }

  /**
   * Add import to file if it doesn't already exist
   */
  private async addImportToFile(filePath: string, importLine: string): Promise<void> {
    if (Utils.lineExistsInFile(filePath, importLine)) {
      console.log('Import already exists in file. Skipping.');
      return;
    }

    try {
      Utils.addImportToFile(filePath, importLine);
      console.log(`Added import: ${importLine}`);
    } catch (error) {
      throw new Error(`Failed to add import to file: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  private log(message: string): void {
    if (this.options.debug) {
      console.error(`[DEBUG] ${message}`);
    }
  }
}