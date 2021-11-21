import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
    path: path.join(process.cwd(), '.env')
});

const CONFIG = {
    PREDICTION: {
        KEY: process.env.PREDICTION_KEY as string,
        PROJECT_ID: process.env.PREDICTION_PROJECT_ID as string,
        ENDPOINT: process.env.PREDICTION_ENDPOINT as string,
        ITERATION_NAME: process.env.PREDICTION_ITERATION_NAME as string
    },
    ASSETS_PATH: path.join(process.env.ASSETS_PATH as string),
};

export default CONFIG;

