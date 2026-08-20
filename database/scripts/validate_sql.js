const fs = require('fs');
const path = require('path');

function splitSqlStatements(sqlText) {
  const statements = [];
  let currentStmt = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;
  let dollarQuoteTag = '';
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
      if (trimmed) {
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

  if (currentStmt.trim()) {
    statements.push({
      sql: currentStmt.trim(),
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

  console.log(`Parsed ${statements.length} SQL statements from schema.sql`);
  statements.forEach((stmt, idx) => {
    const firstLine = stmt.sql.split('\n')[0];
    console.log(`Stmt #${idx + 1} (Lines ${stmt.startLine}-${stmt.endLine}): ${firstLine.slice(0, 80)}`);
  });
}

if (require.main === module) {
  runValidation();
}

module.exports = { splitSqlStatements };
