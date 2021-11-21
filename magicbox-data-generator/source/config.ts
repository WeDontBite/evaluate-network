import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
    path: path.join(process.cwd(), '.env')
});

const CONFIG = {
    DETECTION: {
        PREDICTION_KEY: process.env.DETECTION_PREDICTION_KEY as string,
        ENDPOINT: process.env.DETECTION_ENDPOINT as string,
        PROJECT_ID: process.env.DETECTION_PROJECT_ID as string,
        ITERATION_NAME: process.env.DETECTION_ITERATION_NAME as string
    },
    CLASSIFICATION: {
        PREDICTION_KEY: process.env.CLASSIFICATION_PREDICTION_KEY as string,
        ENDPOINT: process.env.CLASSIFICATION_ENDPOINT as string,
        PROJECT_ID: process.env.CLASSIFICATION_PROJECT_ID as string,
        ITERATION_NAME: process.env.CLASSIFICATION_ITERATION_NAME as string
    },
    ASSETS_PATH: path.join(process.env.ASSETS_PATH as string),
};

export default CONFIG;

