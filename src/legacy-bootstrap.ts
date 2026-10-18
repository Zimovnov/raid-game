import { Game } from './main.js';
import { esc } from './ui/helpers.js';

try {
    const game = new Game();
    void game.boot();
} catch (error) {
    document.getElementById('app')!.innerHTML = `<section class="boot"><h2>Игра не запустилась</h2><p>${esc((error as Error).message)}</p><p>Используйте актуальный Chrome или Edge с включённым WebGL2. Запускайте через HTTP, не file://.</p></section>`;
    console.error(error);
}
