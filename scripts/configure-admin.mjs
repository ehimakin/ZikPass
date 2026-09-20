import { randomBytes, scryptSync } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';

function hidden(prompt) {
  if (!process.stdin.isTTY) throw new Error('Use --password-stdin with piped input, or run interactively in a terminal.');
  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => {
      process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onData = buffer => {
      for (const char of buffer.toString('utf8')) {
        if (char === '\u0003') return finish(new Error('Cancelled. No credentials were written.'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') { value = value.slice(0, -1); continue; }
        if (char >= ' ') value += char;
        if (value.length > 256) return finish(new Error('Password is too long.'));
      }
    };
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on('data', onData);
  });
}
async function main() {
  const args = process.argv.slice(2);
  let username = args.includes('--username') ? args[args.indexOf('--username') + 1] : '';
  let password;
  if (args.includes('--password-stdin')) {
    if (!username) throw new Error('Provide --username when using --password-stdin.');
    const chunks = []; for await (const chunk of process.stdin) { chunks.push(chunk); if (Buffer.concat(chunks).length > 1024) throw new Error('Password is too long.'); }
    password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    if (!username) username = (await rl.question('Admin username [owner]: ')).trim() || 'owner';
    rl.close();
    password = await hidden('Admin password (14+ characters; input hidden): ');
    const confirmation = await hidden('Confirm password: ');
    if (password !== confirmation) throw new Error('Passwords did not match. No credentials were written.');
  }
  if (!/^[A-Za-z0-9@._-]{1,80}$/.test(username)) throw new Error('Use 1–80 letters, digits, @, dot, underscore or hyphen for the username.');
  if (password.length < 14 || password.length > 256) throw new Error('Use a password between 14 and 256 characters.');
  const salt = randomBytes(16).toString('hex');
  const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
  password = '';
  const file = path.join(process.cwd(), '.env.local');
  let current = '';
  try { current = await readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const [key, value] of Object.entries({ ZIK_ADMIN_USERNAME: username, ZIK_ADMIN_PASSWORD_HASH: hash })) {
    const line = `${key}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    current = pattern.test(current) ? current.replace(pattern, line) : `${current.trimEnd()}\n${line}\n`;
  }
  await writeFile(file, current, { mode: 0o600 }); await chmod(file, 0o600);
  process.stdout.write('Admin credentials saved in .env.local. Restart the app, then open /admin. Changing these credentials invalidates previous admin sessions.\n');
}
main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
