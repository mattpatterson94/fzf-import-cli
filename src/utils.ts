import * as fs from 'fs';
import * as path from 'path';

export class Utils {
  /**
   * Calculate relevance score between a search keyword and an import statement
   * Higher score means better match
   */
  static calculateRelevanceScore(importLine: string, keyword: string): number {
    if (!keyword || !importLine) return 0;
    
    // Extract the import name
    const importMatch = importLine.match(/from\s+['"](.*?)['"]/);
    const importName = importMatch ? importMatch[1] : '';
    
    // Extract symbol names
    const symbolsMatch = importLine.match(/import\s+(?:type\s+)?({[^}]*}|\*\s+as\s+\w+|\w+)/);
    const symbolsText = symbolsMatch ? symbolsMatch[1] : '';
    
    let score = 0;
    
    // Exact match in the import path (highest priority)
    if (importName && importName.includes(keyword)) {
      // Direct match in module name is highest priority
      score += 100;
      
      // Exact match is better than partial
      if (importName === keyword) {
        score += 50;
      }
      
      // Match at start of segment is better
      const segments = importName.split('/');
      for (const segment of segments) {
        if (segment.startsWith(keyword)) {
          score += 30;
        }
      }
    }
    
    // Match in the symbol names (second priority)
    if (symbolsText && symbolsText.includes(keyword)) {
      score += 80;
      
      // Check if it's a named export with destructuring (has braces)
      const hasDestructuring = symbolsText.startsWith('{') && symbolsText.endsWith('}');
      
      if (hasDestructuring) {
        // Parse the symbols inside the destructuring
        const symbolParts = symbolsText.replace(/[{}]/g, '').split(',');
        
        // Prefer single imports
        if (symbolParts.length === 1 && symbolParts[0].trim() === keyword) {
          // Single import with exact match gets highest score
          score += 60;
        } else {
          // Multiple imports with exact match
          for (const part of symbolParts) {
            const trimmed = part.trim();
            if (trimmed === keyword) {
              score += 40;
            } else if (trimmed.startsWith(keyword)) {
              score += 20;
            }
          }
        }
      } else {
        // Default import or namespace import
        if (symbolsText === keyword) {
          // Default import with exact match
          score += 60;
        } else if (symbolsText.includes(keyword)) {
          // Namespace import
          score += 40;
        }
      }
    }
    
    // General match in the import line
    if (score === 0 && importLine.includes(keyword)) {
      score += 10;
    }
    
    return score;
  }
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
   * Add import line before the first existing import, or at the top after comments
   */
  static addImportToFile(filePath: string, importLine: string): void {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Find the best position to insert the import
    let insertIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments at the top
      if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
        insertIndex = i + 1; // Position after comments/empty lines
        continue;
      }
      
      // If this is an import statement, insert before it
      if (line.startsWith('import ')) {
        insertIndex = i;
        break;
      } else {
        // First non-comment, non-import line - insert here
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