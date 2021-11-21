import * as fs from 'fs';
import * as dree from 'dree';
import * as PredictionApi from '@azure/cognitiveservices-customvision-prediction';
import * as msRest from '@azure/ms-rest-js';

import logger from './logger';
import path = require('path/posix');
import { BoundingBox } from '@azure/cognitiveservices-customvision-prediction/esm/models';

interface PredictionCredentials {
    PREDICTION_KEY: string;
    ENDPOINT: string;
    PROJECT_ID: string;
    ITERATION_NAME: string;
}

interface ImageInfo {
    id: number;
    date: Date;
    scratch: number;
    imgUrl: string;
    box: {
        top: number;
        left: number;
        width: number;
        height: number;
    } | null;
}

export class Predictor {

    private detector: PredictionApi.PredictionAPIClient;
    private classificator: PredictionApi.PredictionAPIClient;

    public images: ImageInfo[] = [];
    private currentDate = new Date('2021-11-20T23:45:30');
    private currentId = 0;

    private async detectImage(imagePath: string): Promise<PredictionApi.PredictionAPIModels.DetectImageResponse> {
        const imageBuffer = fs.readFileSync(imagePath);
        return this.detector.detectImage(this.detection.PROJECT_ID, this.detection.ITERATION_NAME, imageBuffer);
    }

    private async classifyImage(imagePath: string): Promise<PredictionApi.PredictionAPIModels.ClassifyImageResponse> {
        const imageBuffer = fs.readFileSync(imagePath);
        return this.classificator.classifyImage(this.classification.PROJECT_ID, this.classification.ITERATION_NAME, imageBuffer);
    }

    private async processImage(imagePath: string): Promise<void> {
        try {
            const result = await this.classifyImage(imagePath);
            if (!result.predictions) {
                logger.warning(`No predictions for ${imagePath}`);
                return;
            }

            const prediction = result.predictions[0];
            let box: BoundingBox | null = null;
            {
                // hahaha hackathon code...
                const result = await this.detectImage(imagePath);
                if (!result.predictions) {
                    logger.warning(`No predictions detection for ${imagePath}`);
                }
                else {
                    const prediction = result.predictions[0];
                    box = prediction.boundingBox ?? null;
                }
            }

            this.images.push({
                id: this.currentId++,
                date: this.currentDate,
                imgUrl: path.join(imagePath),
                scratch: prediction.tagName === 'bad' ? (prediction.probability ?? 0) : (1 - (prediction.probability ?? 0)),
                box
            });
            this.currentDate.setMinutes(this.currentDate.getMinutes() + 5);
        }
        catch (error) {
            logger.error(`Error processing image ${imagePath}`, error);
        }
    }


    public async processAll(assetsPath: string): Promise<void> {
        const files: string[] = [];

        await dree.scanAsync(assetsPath, {
            extensions: ['jpg', 'jpeg', 'png']
        }, file => {
            files.push(file.path);
        });

        for (const file of files) {
            logger.debug(`Testing file ${file}`);
            await this.processImage(file);
        }

        fs.writeFileSync('./result.json', JSON.stringify(this.images, null, 2));
    }

    constructor(private detection: PredictionCredentials, private classification: PredictionCredentials) {
        const detectorCredentials = new msRest.ApiKeyCredentials({ inHeader: { "Prediction-key": detection.PREDICTION_KEY } });
        this.detector = new PredictionApi.PredictionAPIClient(detectorCredentials, detection.ENDPOINT);

        const classificatorCredentials = new msRest.ApiKeyCredentials({ inHeader: { "Prediction-key": classification.PREDICTION_KEY } });
        this.classificator = new PredictionApi.PredictionAPIClient(classificatorCredentials, classification.ENDPOINT);
    }
}

