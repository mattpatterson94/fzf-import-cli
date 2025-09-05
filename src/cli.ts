#!/usr/bin/env node

import { Command } from 'commander';
import { FzfImport } from './fzf-import';
import { Utils } from './utils';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('fzf-import')
  .description('CLI tool for finding and importing JavaScript/TypeScript modules')
  .version('1.0.0')
  .argument('<file>', 'target file to add imports to (supports file:row:col format)')
  .argument('[keyword]', 'keyword to search for (optional - if not provided, interactive mode is used)')
  .option('-d, --debug', 'enable debug output')
  .action(async (fileArg: string, keyword?: string, options?: { debug?: boolean }) => {
    try {
      // Check dependencies first
      const dependencyError = Utils.checkDependencies();
      if (dependencyError) {
        console.error(`Error: ${dependencyError}`);
        process.exit(1);
      }

      // Parse file argument to check for row:col format
      const parseFileArgument = (arg: string): { filePath: string; row?: number; col?: number } => {
        const parts = arg.split(':');
        if (parts.length === 3) {
          // file:row:col format
          const filePath = parts[0];
          const row = parseInt(parts[1], 10);
          const col = parseInt(parts[2], 10);
          
          if (isNaN(row) || isNaN(col) || row < 1 || col < 1) {
            throw new Error('Invalid row or column number. Format: file:row:col (1-indexed)');
          }
          
          return { filePath, row, col };
        } else if (parts.length === 1) {
          // Just file path
          return { filePath: parts[0] };
        } else {
          throw new Error('Invalid file format. Use either "file" or "file:row:col"');
        }
      };

      const parsed = parseFileArgument(fileArg);
      const absolutePath = path.resolve(parsed.filePath);
      
      // Validate file path
      if (!fs.existsSync(absolutePath)) {
        console.error(`Error: File does not exist: ${absolutePath}`);
        process.exit(1);
      }

      // Check if file is a supported type
      const ext = path.extname(absolutePath).slice(1);
      const supportedExts = ['js', 'jsx', 'ts', 'tsx'];
      if (!supportedExts.includes(ext)) {
        console.error(`Error: Unsupported file type. Supported: ${supportedExts.join(', ')}`);
        process.exit(1);
      }

      const fzfImport = new FzfImport({ debug: options?.debug });
      
      if (parsed.row && parsed.col) {
        // Position-based search mode
        await fzfImport.searchAndImportAtPosition(absolutePath, parsed.row, parsed.col);
      } else if (keyword) {
        // Keyword search mode
        await fzfImport.searchAndImport(absolutePath, keyword);
      } else {
        // Interactive mode
        await fzfImport.interactiveImport(absolutePath);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();