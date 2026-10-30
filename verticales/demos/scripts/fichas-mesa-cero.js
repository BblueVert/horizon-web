// Crea en fichas/ una demo por cada restaurante que ya está cargado en Supabase de
// Mesa Cero (tenants con carta real). Todas responden por el flujo n8n a la vez,
// cada chat con su restaurante, sin reiniciar. Uso: npm run fichas-mesa-cero
import { writeFileSync, mkdirSync } from 'node:fs';
import { config } from '../src/config.js';

const TENANTS = [
  ['tia-julia', 'Tía Julia'], ['sra-fang', 'Sra Fang'], ['magari', 'Magari'],
  ['cafe-haiti', 'Café Haití'], ['cheveroni', 'Cheveroni Pizza'], ['delicia-china', 'Delicia China Restaurant'],
  ['kami-sushi', 'Kami Sushi Rancagua'], ['okus', 'Okus Restobar'], ['que-rolls', 'Que Rolls Sushi'],
  ['janito', 'Restaurant Janito'], ['don-teo', 'Restobar de Don Teo'], ['torino', 'Torino Ristorante'],
  ['yummy-sabroso', 'Yummy Sabroso'], ['montenegros', "Montenegro's Pizza"],
];

mkdirSync(config.bot.carpetaFichas, { recursive: true });
for (const [tenant, nombre] of TENANTS) {
  const slug = tenant === 'tia-julia' ? tenant : `mc-${tenant}`;
  writeFileSync(`${config.bot.carpetaFichas}/${slug}.json`, JSON.stringify({
    slug, nombre, rubro: 'restaurante', flujo: 'pedidos', motor: 'mesa-cero', tenant,
    descripcion: `Demo Mesa Cero con la carta real de ${nombre} (tenant "${tenant}" en Supabase).`,
    fuentes: [`mesa-cero: tenant ${tenant}`],
  }, null, 2) + '\n');
}
console.log(`${TENANTS.length} fichas Mesa Cero en ${config.bot.carpetaFichas}/. En el bot: #demos recargar`);
