import { spawn } from 'child_process';
import { Transform } from 'stream';
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

    this.log(`Streaming search for imports containing: ${keyword}`);
    this.log(`File type: ${fileType}`);
    this.log(`Pattern: ${searchResult.pattern}`);

    // Use streaming search for real-time results
    const selected = await this.streamingSearchAndSelect(
      searchResult.pattern,
      filePath,
      `Select import for "${keyword}"`,
      keyword
    );

    if (selected) {
      await this.addImportToFile(filePath, selected);
    } else {
      console.log('No import selected or no matches found.');
    }
  }

  /**
   * Search for imports using symbol at specific position and add to file
   */
  async searchAndImportAtPosition(filePath: string, row: number, col: number): Promise<void> {
    this.log(`Position-based search at ${filePath}:${row}:${col}`);
    
    const symbol = Utils.getSymbolAtPosition(filePath, row, col);
    if (!symbol) {
      console.log(`No symbol found at position ${row}:${col}`);
      return;
    }

    this.log(`Found symbol at position: "${symbol}"`);
    
    // Use the existing searchAndImport method with the extracted symbol
    await this.searchAndImport(filePath, symbol);
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

    this.log(`Interactive streaming mode for: ${filePath}`);
    this.log(`File type: ${fileType}`);

    // Search for all import statements (remove %s placeholders for general search)
    const pattern = config.regex.replace(/%s/g, '\\w+');

    // Use streaming search for real-time results
    const selected = await this.streamingSearchAndSelect(
      pattern,
      filePath,
      'Select import to add'
    );

    if (selected) {
      await this.addImportToFile(filePath, selected);
    } else {
      console.log('No import selected or no matches found.');
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
   * Create a transform stream that deduplicates lines and sorts by relevance
   * @param keyword The keyword to use for relevance sorting (optional)
   */
  private createDeduplicateStream(keyword: string = ''): Transform {
    const seen = new Set<string>();
    let buffer = '';
    
    // Performance optimization: Use a score cache to avoid recalculating scores
    const scoreCache = new Map<string, number>();
    
    // Store results for batch processing
    const currentBatch: { line: string; score: number }[] = [];
    const shouldSort = keyword !== '';
    
    // Batch size control (smaller batches = faster display)
    const BATCH_SIZE = 20;
    
    // Helper function to check if a line is a relative import
    const isRelativeImport = (line: string): boolean => {
      // Fast check for relative imports
      return line.includes("from './") || line.includes("from '../");
    };
    
    // Helper function to calculate and cache score
    const getScore = (line: string): number => {
      if (scoreCache.has(line)) {
        return scoreCache.get(line)!;
      }
      
      const score = Utils.calculateRelevanceScore(line, keyword);
      scoreCache.set(line, score);
      return score;
    };
    
    // Helper function to sort and output a batch
    const processBatch = (callback: any) => {
      if (currentBatch.length === 0) {
        callback();
        return;
      }
      
      // Sort by score and then by length
      currentBatch.sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
        return a.line.length - b.line.length;
      });
      
      // Output this batch
      const sortedLines = currentBatch.map(r => r.line);
      callback(null, sortedLines.join('\n') + '\n');
      
      // Clear the batch for next time
      currentBatch.length = 0;
    };
    
    return new Transform({
      objectMode: false,
      transform(chunk: Buffer, encoding: string, callback) {
        // Add chunk to buffer and split by lines
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';
        
        const uniqueLines: string[] = [];
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine) {
            // Fast path: Skip relative imports
            if (isRelativeImport(trimmedLine)) {
              continue;
            }
            
            // Add unique non-relative imports
            if (!seen.has(trimmedLine)) {
              seen.add(trimmedLine);
              
              // Process based on sorting mode
              if (shouldSort) {
                // For sorting mode, add to current batch with score
                const score = getScore(trimmedLine);
                currentBatch.push({ line, score });
                
                // Process batch when it gets large enough
                if (currentBatch.length >= BATCH_SIZE) {
                  processBatch(callback);
                  return; // Return after processing a batch
                }
              } else {
                // For non-sorting mode, just add directly
                uniqueLines.push(line);
              }
            }
          } else if (!shouldSort) {
            // Only keep empty lines in non-sorting mode
            uniqueLines.push(line);
          }
        }
        
        // Output non-sorted results immediately
        if (!shouldSort && uniqueLines.length > 0) {
          callback(null, uniqueLines.join('\n') + '\n');
        } else {
          callback();
        }
      },
      
      // Handle final buffer content
      flush(callback) {
        // Handle any remaining buffer content
        if (buffer.trim()) {
          const trimmedLine = buffer.trim();
          
          if (!isRelativeImport(trimmedLine) && !seen.has(trimmedLine)) {
            seen.add(trimmedLine);
            
            // Process based on sorting mode
            if (shouldSort) {
              const score = getScore(trimmedLine);
              currentBatch.push({ line: buffer, score });
            } else {
              callback(null, buffer);
              return;
            }
          }
        }
        
        // Process any remaining batch items
        if (shouldSort && currentBatch.length > 0) {
          processBatch(callback);
        } else {
          callback();
        }
      }
    });
  }

  /**
   * Stream search results directly from ripgrep to fzf for real-time filtering
   * @param pattern The ripgrep search pattern
   * @param targetFile The target file to add imports to
   * @param prompt The prompt to display in fzf
   * @param keyword The keyword to use for relevance sorting (optional)
   */
  private async streamingSearchAndSelect(pattern: string, targetFile: string, prompt: string, keyword: string = ''): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const cwd = Utils.findProjectRoot(targetFile);
      const rgArgs = [
        pattern,
        ...Config.ripgrepOptions.extraArgs,
        '--glob', `*.{ts,tsx,js,jsx}`,
        '--type-not', 'lock',
        '.'
      ];

      const fzfArgs = [
        '--prompt', `${prompt}> `,
        '--height', '40%',
        '--layout', 'reverse',
        '--border'
      ];

      if (keyword) {
        this.log(`Streaming search with deduplication and relevance sorting: rg ${rgArgs.join(' ')} | dedupe+sort | fzf`);
      } else {
        this.log(`Streaming search with deduplication: rg ${rgArgs.join(' ')} | dedupe | fzf`);
      }
      this.log(`Project root: ${cwd}`);

      // Start both processes
      const rg = spawn('rg', rgArgs, { cwd });
      const fzf = spawn('fzf', fzfArgs);

      let fzfOutput = '';
      let fzfError = '';

      // Create deduplication stream with keyword for sorting
      const deduplicateStream = this.createDeduplicateStream(keyword);

      // Pipe: ripgrep -> deduplicate -> fzf
      rg.stdout.pipe(deduplicateStream).pipe(fzf.stdin);

      // Handle pipe errors (EPIPE when fzf closes early)
      rg.stdout.on('error', (err: any) => {
        if (err.code === 'EPIPE') {
          this.log('Ripgrep stdout pipe closed (expected when selection made)');
          return;
        }
        this.log(`Ripgrep stdout error: ${err.message}`);
      });

      deduplicateStream.on('error', (err: any) => {
        if (err.code === 'EPIPE') {
          this.log('Deduplicate stream pipe closed (expected when selection made)');
          return;
        }
        this.log(`Deduplicate stream error: ${err.message}`);
      });

      // Handle fzf output
      fzf.stdout.on('data', (data) => {
        fzfOutput += data.toString();
      });

      fzf.stderr.on('data', (data) => {
        fzfError += data.toString();
      });

      // Handle ripgrep errors
      rg.stderr.on('data', (data) => {
        this.log(`ripgrep error: ${data.toString()}`);
      });

      // When ripgrep finishes, close fzf input
      rg.on('close', (code) => {
        if (code === 1) {
          // No matches found - close fzf stdin gracefully
          fzf.stdin.end();
        } else if (code !== 0) {
          fzf.kill();
          reject(new Error(`ripgrep failed with code ${code}`));
          return;
        } else {
          // Success - close fzf stdin
          fzf.stdin.end();
        }
      });

      // Handle fzf completion
      fzf.on('close', (code) => {
        // Clean up streams and processes when fzf closes
        if (!rg.killed) {
          rg.kill('SIGTERM');
          // Force kill after timeout if needed
          setTimeout(() => {
            if (!rg.killed) {
              rg.kill('SIGKILL');
            }
          }, 1000);
        }
        
        // Clean up the deduplicate stream
        deduplicateStream.destroy();

        if (code === 130) {
          // User cancelled
          console.log('Selection cancelled.');
          resolve(null);
          return;
        }

        if (code !== 0) {
          reject(new Error(`fzf failed with code ${code}: ${fzfError}`));
          return;
        }

        const selected = fzfOutput.trim();
        resolve(selected || null);
      });

      // Handle process errors
      rg.on('error', (err: any) => {
        // EPIPE is expected when fzf closes early - don't treat as error
        if (err.code === 'EPIPE') {
          this.log('Ripgrep pipe closed (expected when selection made)');
          return;
        }
        reject(new Error(`Failed to start ripgrep: ${err.message}`));
      });

      fzf.on('error', (err) => {
        reject(new Error(`Failed to start fzf: ${err.message}`));
      });
    });
  }

  /**
   * Use fzf to select from a list of options (fallback for non-streaming cases)
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