const fs = require('fs');
const path = require('path');

/**
 * Checks if a SQL string contains actual executable SQL statements
 * (ignoring line comments '--' and block comments '/* ... *\/')
 */
function hasExecutableSql(sqlText) {
  if (!sqlText || !sqlText.trim()) return false;
  let clean = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    const nextChar = sqlText[i + 1] || '';

    if (char === '\n') {
      if (inLineComment) inLineComment = false;
      continue;
    }

    if (inLineComment) continue;

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '-' && nextChar === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      clean += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      clean += char;
      continue;
    }

    clean += char;
  }

  return clean.replace(/;/g, '').trim().length > 0;
}

function splitSqlStatements(sqlText) {
  const statements = [];
  let currentStmt = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  
  let line = 1;
  let stmtStartLine = 1;

  for (let i = 0; i < sqlText.length; i++) {
    const char = sqlText[i];
    const nextChar = sqlText[i + 1] || '';

    if (char === '\n') {
      line++;
      if (inLineComment) {
        inLineComment = false;
      }
    }

    if (inLineComment) {
      currentStmt += char;
      continue;
    }

    if (inBlockComment) {
      currentStmt += char;
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        currentStmt += '/';
        i++;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '$') {
        const remaining = sqlText.slice(i);
        const match = remaining.match(/^(\$[a-zA-Z0-9_]*\$)/);
        if (match) {
          const tag = match[1];
          if (!inDollarQuote) {
            inDollarQuote = tag;
            currentStmt += tag;
            i += tag.length - 1;
            continue;
          } else if (inDollarQuote === tag) {
            inDollarQuote = false;
            currentStmt += tag;
            i += tag.length - 1;
            continue;
          }
        }
      }
    }

    if (!inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      if (char === '-' && nextChar === '-') {
        inLineComment = true;
        currentStmt += char;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        currentStmt += char;
        continue;
      }
    }

    if (char === "'" && !inDoubleQuote && !inDollarQuote) {
      inSingleQuote = !inSingleQuote;
      currentStmt += char;
      continue;
    }

    if (char === '"' && !inSingleQuote && !inDollarQuote) {
      inDoubleQuote = !inDoubleQuote;
      currentStmt += char;
      continue;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote && !inDollarQuote) {
      const trimmed = currentStmt.trim();
      if (trimmed && hasExecutableSql(trimmed)) {
        statements.push({
          sql: trimmed,
          startLine: stmtStartLine,
          endLine: line
        });
      }
      currentStmt = '';
      stmtStartLine = line;
      continue;
    }

    if (currentStmt.trim() === '') {
      stmtStartLine = line;
    }
    currentStmt += char;
  }

  const finalTrimmed = currentStmt.trim();
  if (finalTrimmed && hasExecutableSql(finalTrimmed)) {
    statements.push({
      sql: finalTrimmed,
      startLine: stmtStartLine,
      endLine: line
    });
  }

  return statements;
}

function runValidation() {
  const schemaPath = path.join(__dirname, '../schema.sql');
  console.log(`[DB] Validating schema path: ${schemaPath}`);
  
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Schema file missing at ${schemaPath}`);
    process.exit(1);
  }

  const sqlText = fs.readFileSync(schemaPath, 'utf8');
  const statements = splitSqlStatements(sqlText);

  console.log(`Parsed ${statements.length} executable SQL statements from schema.sql`);
  statements.forEach((stmt, idx) => {
    const lines = stmt.sql.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'));
    const firstExecLine = lines[0] || stmt.sql.split('\n')[0];
    console.log(`Stmt #${idx + 1} (Lines ${stmt.startLine}-${stmt.endLine}): ${firstExecLine.slice(0, 80)}`);
  });
}

if (require.main === module) {
  runValidation();
}

module.exports = { splitSqlStatements, hasExecutableSql };
