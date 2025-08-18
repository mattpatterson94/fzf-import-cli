import * as fs from 'fs';
import * as path from 'path';

export class Utils {
  /**
   * Get file type from file extension
   */
  static getFileType(filePath: string): string {
    const ext = path.extname(filePath).slice(1);
    
    switch (ext) {
      case 'ts':
        return 'typescript';
      case 'tsx':
        return 'typescriptreact';
      case 'js':
        return 'javascript';
      case 'jsx':
        return 'javascriptreact';
      default:
        return ext;
    }
  }

  /**
   * Check if a line already exists in the file
   */
  static lineExistsInFile(filePath: string, line: string): boolean {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      return lines.some(l => l.trim() === line.trim());
    } catch (error) {
      return false;
    }
  }

  /**
   * Add import line to the top of file (after any existing imports)
   */
  static addImportToFile(filePath: string, importLine: string): void {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Find the best position to insert the import
    let insertIndex = 0;
    let foundImports = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments at the top
      if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
        continue;
      }
      
      // If this is an import statement, mark that we found imports
      if (line.startsWith('import ')) {
        foundImports = true;
        insertIndex = i + 1;
      } else if (foundImports) {
        // We've passed all imports, stop here
        break;
      } else {
        // First non-comment, non-import line
        insertIndex = i;
        break;
      }
    }
    
    // Insert the import line
    lines.splice(insertIndex, 0, importLine);
    
    // Write back to file
    fs.writeFileSync(filePath, lines.join('\n'));
  }

  /**
   * Escape special regex characters for ripgrep
   */
  static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Find the project root by walking up directories until package.json is found
   */
  static findProjectRoot(startPath: string): string {
    let currentDir = path.dirname(path.resolve(startPath));
    
    while (currentDir !== path.dirname(currentDir)) { // Stop at filesystem root
      const packageJsonPath = path.join(currentDir, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        return currentDir;
      }
      
      // Move up one directory
      currentDir = path.dirname(currentDir);
    }
    
    // If no package.json found, return the directory of the original file
    return path.dirname(path.resolve(startPath));
  }

  /**
   * Extract the symbol/word at a specific position in a file
   * @param filePath Path to the file
   * @param row Line number (1-indexed)
   * @param col Column number (1-indexed)
   * @returns The symbol at the specified position, or null if not found
   */
  static getSymbolAtPosition(filePath: string, row: number, col: number): string | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Convert to 0-indexed
      const lineIndex = row - 1;
      const colIndex = col - 1;
      
      if (lineIndex < 0 || lineIndex >= lines.length) {
        return null;
      }
      
      const line = lines[lineIndex];
      if (colIndex < 0 || colIndex >= line.length) {
        return null;
      }
      
      // Find word boundaries around the position
      const isWordChar = (char: string): boolean => {
        return /[a-zA-Z0-9_$]/.test(char);
      };
      
      // If current position is not a word character, return null
      if (!isWordChar(line[colIndex])) {
        return null;
      }
      
      // Find start of word
      let start = colIndex;
      while (start > 0 && isWordChar(line[start - 1])) {
        start--;
      }
      
      // Find end of word
      let end = colIndex;
      while (end < line.length - 1 && isWordChar(line[end + 1])) {
        end++;
      }
      
      return line.substring(start, end + 1);
    } catch (error) {
      return null;
    }
  }
}