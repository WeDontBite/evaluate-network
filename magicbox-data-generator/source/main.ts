import { Predictor } from './predictor';
import CONFIG from './config';


async function main() {
    const predictor = new Predictor(CONFIG.DETECTION, CONFIG.CLASSIFICATION);
    await predictor.processAll(CONFIG.ASSETS_PATH);
}
main();
