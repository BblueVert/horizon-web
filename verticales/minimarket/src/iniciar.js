// `npm start`: levanta el agente y el puente en el mismo equipo (dos procesos).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const hijos = ['servidor.js', 'puente.js'].map(f => spawn(process.execPath, [join(aqui, f)], { stdio: 'inherit' }));

for (const h of hijos) {
  h.on('exit', (codigo) => {
    console.error(`[iniciar] un proceso terminó (código ${codigo}). Cerrando todo.`);
    for (const otro of hijos) if (otro !== h) otro.kill();
    process.exit(codigo || 1);
  });
}
process.on('SIGINT', () => { for (const h of hijos) h.kill('SIGINT'); process.exit(0); });
