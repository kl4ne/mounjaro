import { readFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';

const path = process.argv[2] || '.github/workflows/deploy.yml';
const source = await readFile(path, 'utf8');
const document = parseDocument(source, { prettyErrors: true, strict: true });
if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join('\n'));
const workflow = document.toJS();
if (!workflow?.jobs?.build || !workflow?.jobs?.deploy) throw new Error('Workflow is missing build or deploy job');
if (workflow.jobs.build['runs-on'] !== 'ubuntu-24.04' || workflow.jobs.deploy['runs-on'] !== 'ubuntu-24.04') throw new Error('Workflow runners must be ubuntu-24.04');
console.log(`YAML parse PASS: ${path}`);
