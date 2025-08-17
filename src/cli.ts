#!/usr/bin/env node

import { Command } from 'commander';
import { FzfImport } from './fzf-import';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('fzf-import')
  .description('CLI tool for finding and importing JavaScript/TypeScript modules')
  .version('1.0.0')
  .argument('<file>', 'target file to add imports to')
  .argument('[keyword]', 'keyword to search for (optional - if not provided, interactive mode is used)')
  .option('-d, --debug', 'enable debug output')
  .action(async (filePath: string, keyword?: string, options?: { debug?: boolean }) => {
    try {
      // Validate file path
      const absolutePath = path.resolve(filePath);
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
      
      if (keyword) {
        // Direct search mode
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