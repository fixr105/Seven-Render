/**
 * Project Consistency Checker
 * Checks for inconsistencies in the project including:
 * - Supabase references in code
 * - Missing dependencies
 * - Configuration issues
 * - TODO items
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname);

const issues = {
  supabase: [],
  missingFiles: [],
  configIssues: [],
  todos: [],
  dependencies: [],
};

/**
 * Check for Supabase references in code files
 */
function checkSupabaseReferences() {
  console.log('🔍 Checking for Supabase references...\n');
  
  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next'];
  
  function scanDirectory(dir, relativePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);
      
      // Skip excluded directories
      if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
        scanDirectory(fullPath, relPath);
        continue;
      }
      
      // Check code files
      if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (codeExtensions.includes(ext)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          // Check for Supabase imports
          const supabasePatterns = [
            /@supabase\/supabase-js/,
            /from ['"]@supabase/,
            /import.*supabase/i,
            /createClient.*supabase/i,
            /supabase\.auth/,
            /supabase\.from\(/,
          ];
          
          supabasePatterns.forEach((pattern, index) => {
            if (pattern.test(content)) {
              const lines = content.split('\n');
              const matchingLines = lines
                .map((line, i) => ({ line: i + 1, content: line }))
                .filter(({ content }) => pattern.test(content));
              
              matchingLines.forEach(({ line, content }) => {
                issues.supabase.push({
                  file: relPath,
                  line,
                  content: content.trim(),
                  type: 'code',
                });
              });
            }
          });
        }
      }
    }
  }
  
  // Scan src directory
  const srcDir = path.join(projectRoot, 'src');
  if (fs.existsSync(srcDir)) {
    scanDirectory(srcDir, 'src');
  }
  
  // Scan backend/src directory
  const backendSrcDir = path.join(projectRoot, 'backend', 'src');
  if (fs.existsSync(backendSrcDir)) {
    scanDirectory(backendSrcDir, 'backend/src');
  }
  
  // Check package.json files
  const packageFiles = [
    path.join(projectRoot, 'package.json'),
    path.join(projectRoot, 'backend', 'package.json'),
  ];
  
  packageFiles.forEach(pkgPath => {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps['@supabase/supabase-js']) {
        issues.supabase.push({
          file: path.relative(projectRoot, pkgPath),
          type: 'dependency',
          content: `@supabase/supabase-js: ${deps['@supabase/supabase-js']}`,
        });
      }
    }
  });
}

/**
 * Check for missing critical files
 */
function checkMissingFiles() {
  console.log('📁 Checking for missing files...\n');
  
  const criticalFiles = [
    'src/services/api.ts',
    'backend/src/server.ts',
    'package.json',
    'backend/package.json',
  ];
  
  // Note: .env.example is optional and may be gitignored
  criticalFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (!fs.existsSync(fullPath)) {
      issues.missingFiles.push(file);
    }
  });
}

/**
 * Check configuration issues
 */
function checkConfigIssues() {
  console.log('⚙️  Checking configuration...\n');
  
  // Check for environment variable references
  const envExample = path.join(projectRoot, '.env.example');
  if (fs.existsSync(envExample)) {
    const content = fs.readFileSync(envExample, 'utf8');
    if (content.includes('SUPABASE')) {
      issues.configIssues.push({
        file: '.env.example',
        issue: 'Contains SUPABASE environment variables',
      });
    }
  }
  
  // Check vite config
  const viteConfig = path.join(projectRoot, 'vite.config.ts');
  if (fs.existsSync(viteConfig)) {
    const content = fs.readFileSync(viteConfig, 'utf8');
    if (content.includes('SUPABASE') || content.includes('supabase')) {
      issues.configIssues.push({
        file: 'vite.config.ts',
        issue: 'Contains Supabase configuration',
      });
    }
  }
}

/**
 * Count TODO items
 */
function checkTodos() {
  console.log('📝 Checking TODO items...\n');
  
  const todoFiles = [
    path.join(projectRoot, 'PROJECT_TODO_ISSUES.md'),
    path.join(projectRoot, 'DASHBOARD_TODO.md'),
  ];
  
  todoFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const todoMatches = content.match(/- \[ \]/g);
      const completedMatches = content.match(/- \[x\]/gi);
      
      if (todoMatches || completedMatches) {
        issues.todos.push({
          file: path.relative(projectRoot, file),
          pending: todoMatches ? todoMatches.length : 0,
          completed: completedMatches ? completedMatches.length : 0,
        });
      }
    }
  });
}

/**
 * Check for dependency inconsistencies
 */
function checkDependencies() {
  console.log('📦 Checking dependencies...\n');
  
  const rootPkg = path.join(projectRoot, 'package.json');
  const backendPkg = path.join(projectRoot, 'backend', 'package.json');
  
  if (fs.existsSync(rootPkg) && fs.existsSync(backendPkg)) {
    const root = JSON.parse(fs.readFileSync(rootPkg, 'utf8'));
    const backend = JSON.parse(fs.readFileSync(backendPkg, 'utf8'));
    
    // Check for duplicate dependencies
    const rootDeps = { ...root.dependencies, ...root.devDependencies };
    const backendDeps = { ...backend.dependencies, ...backend.devDependencies };
    
    Object.keys(rootDeps).forEach(dep => {
      if (backendDeps[dep] && rootDeps[dep] !== backendDeps[dep]) {
        issues.dependencies.push({
          package: dep,
          root: rootDeps[dep],
          backend: backendDeps[dep],
          issue: 'Version mismatch',
        });
      }
    });
  }
}

/**
 * Generate report
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 PROJECT CONSISTENCY REPORT');
  console.log('='.repeat(60) + '\n');
  
  // Supabase issues
  if (issues.supabase.length > 0) {
    console.log('❌ SUPABASE REFERENCES FOUND:');
    console.log(`   Total: ${issues.supabase.length}\n`);
    issues.supabase.forEach(issue => {
      if (issue.type === 'code') {
        console.log(`   📄 ${issue.file}:${issue.line}`);
        console.log(`      ${issue.content.substring(0, 80)}...`);
      } else {
        console.log(`   📦 ${issue.file}`);
        console.log(`      ${issue.content}`);
      }
    });
    console.log('');
  } else {
    console.log('✅ No Supabase references found in code\n');
  }
  
  // Missing files
  if (issues.missingFiles.length > 0) {
    console.log('⚠️  MISSING FILES:');
    issues.missingFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
    console.log('');
  } else {
    console.log('✅ All critical files present\n');
  }
  
  // Config issues
  if (issues.configIssues.length > 0) {
    console.log('⚠️  CONFIGURATION ISSUES:');
    issues.configIssues.forEach(issue => {
      console.log(`   📄 ${issue.file}: ${issue.issue}`);
    });
    console.log('');
  } else {
    console.log('✅ No configuration issues found\n');
  }
  
  // TODOs
  if (issues.todos.length > 0) {
    console.log('📝 TODO ITEMS:');
    issues.todos.forEach(todo => {
      console.log(`   📄 ${todo.file}:`);
      console.log(`      Pending: ${todo.pending}`);
      console.log(`      Completed: ${todo.completed}`);
    });
    console.log('');
  }
  
  // Dependencies
  if (issues.dependencies.length > 0) {
    console.log('⚠️  DEPENDENCY ISSUES:');
    issues.dependencies.forEach(dep => {
      console.log(`   📦 ${dep.package}:`);
      console.log(`      Root: ${dep.root}`);
      console.log(`      Backend: ${dep.backend}`);
    });
    console.log('');
  } else {
    console.log('✅ No dependency issues found\n');
  }
  
  // Summary
  console.log('='.repeat(60));
  console.log('📈 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Supabase Issues: ${issues.supabase.length}`);
  console.log(`Missing Files: ${issues.missingFiles.length}`);
  console.log(`Config Issues: ${issues.configIssues.length}`);
  console.log(`TODO Files: ${issues.todos.length}`);
  console.log(`Dependency Issues: ${issues.dependencies.length}`);
  
  const totalIssues = issues.supabase.length + 
                     issues.missingFiles.length + 
                     issues.configIssues.length + 
                     issues.dependencies.length;
  
  console.log(`\nTotal Issues: ${totalIssues}`);
  
  if (totalIssues === 0) {
    console.log('\n✅ Project is consistent! No issues found.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Please review and fix the issues above.\n');
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting project consistency check...\n');
  
  checkSupabaseReferences();
  checkMissingFiles();
  checkConfigIssues();
  checkTodos();
  checkDependencies();
  
  generateReport();
}

main().catch(error => {
  console.error('❌ Error running consistency check:', error);
  process.exit(1);
});











