import * as fs from 'fs';
import * as path from 'path';
import * as PredictionApi from '@azure/cognitiveservices-customvision-prediction';
import * as msRest from '@azure/ms-rest-js';

import logger from './logger';

interface FailDetails {
    path: string;
    expected: string;
    actual: string;
    accuracy: number;
}

export class Predictor {

    private predictor: PredictionApi.PredictionAPIClient;
    private projectId!: string;
    private iterationName!: string;

    public failedImages: FailDetails[] = [];
    public results: any = {};

    public get generalResults(): any {
        return Object.keys(this.results).reduce<any>((res, key) => {
            res.nFailed += this.results[key].nFailed;
            res.nSuccess += this.results[key].nSuccess;
            res.nTotal += this.results[key].nTotal;

            return res;
        }, { nFailed: 0, nSuccess: 0, nTotal: 0 });
    }

    private async classifyImage(imagePath: string): Promise<PredictionApi.PredictionAPIModels.ClassifyImageResponse> {
        const imageBuffer = fs.readFileSync(imagePath);
        return this.predictor.detectImage(this.projectId, this.iterationName, imageBuffer);
    }

    private async testImage(imagePath: string, expected: string, className: string): Promise<void> {
        let result: any;
        try {
            result = await this.classifyImage(imagePath);
        }
        catch (error) {
            logger.warning('There was a network err', error);
            return;
        }

        if (!result.predictions) {
            logger.warning(`Could not classify image ${imagePath}`);
            return;
        }

        const prediction = result.predictions[0];
        if (prediction.tagName !== expected) {
            this.failedImages.push({
                path: imagePath,
                expected,
                actual: prediction.tagName as string,
                accuracy: prediction.probability as number
            });

            this.results[className].nFailed++;
        }
        else {
            this.results[className].nSuccess++;
        }

        this.results[className].nTotal++;
    }

    private async testImagesClassExpection(classExpectionPath: string, classExpectation: string, className: string): Promise<void> {
        const files = await fs.promises.readdir(classExpectionPath);

        const promises: Promise<void>[] = [];

        for (const file of files) {
            const filePath = path.join(classExpectionPath, file);
            promises.push(this.testImage(filePath, classExpectation, className));
        }

        await Promise.all(promises);
    }


    public async testClass(classPath: string, className: string): Promise<void> {
        const classExpectations = await fs.promises.readdir(classPath);

        for (const classExpectation of classExpectations) {
            logger.info(`Testing class expectation ${classExpectation}`);

            const classExpectationPath = path.join(classPath, classExpectation);
            await this.testImagesClassExpection(classExpectationPath, classExpectation, className);
        }

        const result = this.results[className];
        logger.debug(`${className} ${result.nSuccess}/${result.nTotal}, Percentage: ${(result.nSuccess / result.nTotal).toFixed(4)}`);
    }

    public async testAll(assetsPath: string): Promise<void> {
        const classes = await fs.promises.readdir(assetsPath);

        for (const className of classes) {
            logger.info(`Testing class ${className}`);

            this.results[className] = {
                nFailed: 0,
                nSuccess: 0,
                nTotal: 0
            };

            const classPath = path.join(assetsPath, className);
            await this.testClass(classPath, className);
        }
    }

    public printResults(): void {
        console.log(JSON.stringify(this.failedImages, null, 2));
        console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');

        for (const className in this.results) {
            const result = this.results[className];
            console.log(`${className} ${result.nSuccess}/${result.nTotal}, Percentage: ${(result.nSuccess / result.nTotal).toFixed(4)}`);
            console.log('------------------------');
        }
        console.log(`Total ${this.generalResults.nSuccess}/${this.generalResults.nTotal}, Percentage: ${(this.generalResults.nSuccess / this.generalResults.nTotal).toFixed(4)}`);

        const reportName = new Date().toISOString();
        const reportConten = {
            general: this.generalResults,
            results: this.results,
            failedImages: this.failedImages
        };
        fs.writeFileSync(`./reports/${reportName}.json`, JSON.stringify(reportConten, null, 2));

    }

    constructor(predictionKey: string, endpoint: string, projectId: string, iterationName: string) {
        this.projectId = projectId;
        this.iterationName = iterationName;

        const predictorCredentials = new msRest.ApiKeyCredentials({ inHeader: { "Prediction-key": predictionKey } });
        this.predictor = new PredictionApi.PredictionAPIClient(predictorCredentials, endpoint);
    }
}

