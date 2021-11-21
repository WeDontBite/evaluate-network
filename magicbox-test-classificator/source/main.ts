import { Predictor } from './predictor';
import CONFIG from './config';


async function main() {
    const predictor = new Predictor(CONFIG.PREDICTION.KEY, CONFIG.PREDICTION.ENDPOINT, CONFIG.PREDICTION.PROJECT_ID, CONFIG.PREDICTION.ITERATION_NAME);
    await predictor.testAll(CONFIG.ASSETS_PATH);
}
main();
