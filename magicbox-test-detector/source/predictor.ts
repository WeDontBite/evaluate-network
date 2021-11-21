import * as fs from 'fs';
import * as path from 'path';
import * as PredictionApi from '@azure/cognitiveservices-customvision-prediction';
import * as msRest from '@azure/ms-rest-js';
import * as polygonOverlap from 'polygon-overlap';
import * as gm from 'gm';
import imageSize from 'image-size';

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

    private async detectImage(imagePath: string): Promise<PredictionApi.PredictionAPIModels.DetectImageResponse> {
        const imageBuffer = fs.readFileSync(imagePath);
        return this.predictor.detectImage(this.projectId, this.iterationName, imageBuffer);
    }

    private async testImage(imagePath: string, jsonPath: string, expected: string, className: string): Promise<void> {
        let result: PredictionApi.PredictionAPIModels.DetectImageResponse;
        try {
            result = await this.detectImage(imagePath);
        }
        catch (error) {
            logger.warning('There was a network err', error);
            return;
        }

        if (!result.predictions || !result.predictions.length) {
            logger.warning(`Could not classify image ${imagePath}`);
            return;
        }

        const prediction = result.predictions.sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1))[0];

        const { width, height } = imageSize(imagePath) as { width: number, height: number };
        const jsonData = JSON.parse(await fs.promises.readFile(jsonPath, 'utf8'));
        const jsonPoints = jsonData.shapes[0].points.map(([w, h]: [number, number]) => ([w / width, h / height]));
        const bb = prediction.boundingBox as PredictionApi.PredictionAPIModels.BoundingBox;
        const predictionPoints: any = [[bb.left, bb.top], [bb.left + bb.width, bb.top], [bb.left + bb.width, bb.top + bb.height], [bb.left, bb.top + bb.height]];

        const outputPath = imagePath.replace('.png', `_${className}_${expected}.png`).replace('assets', 'report_assets');
        let pp = predictionPoints.map(([w, h]: [number, number]) => ([w * width, h * height]));
        let jp = jsonPoints.map(([w, h]: [number, number]) => ([w * width, h * height]));
        try {
            gm(path.join(imagePath))
                .stroke('red')
                .drawPolygon(pp[0], pp[1], pp[2], pp[3], pp[0])
                .stroke('green')
                .drawPolygon(jp[0], jp[1], jp[2], jp[3], jp[0])
                .write(outputPath, (error) => { if (error) console.error(error); });
        }
        catch (error) {
            logger.warning('There was graphic magic error', error);
            return;
        }

        console.log(bb)

        // console.log(jsonPoints)
        // console.log(predictionPoints)
        // console.log(polygonOverlap(jsonPoints, predictionPoints))

        if (!polygonOverlap(jsonPoints, predictionPoints)) {
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
        const files = (await fs.promises.readdir(classExpectionPath)).filter(file => file.endsWith('.png'));

        for (const file of files) {
            logger.debug(`Testing image ${file}`);
            const imagePath = path.join(classExpectionPath, file);
            await this.testImage(imagePath, imagePath.replace('.png', '.json'), classExpectation, className);
        }

        const result = this.results[className];
        logger.debug(`${className} ${result.nSuccess}/${result.nTotal}, Percentage: ${(result.nSuccess / result.nTotal).toFixed(4)}`);

    }

    public async testClass(classPath: string, className: string): Promise<void> {
        const classExpectations = ['bad']; // TODO: note it is hardcoded

        for (const classExpectation of classExpectations) {
            logger.info(`Testing class expectation ${classExpectation}`);

            const classExpectationPath = path.join(classPath, classExpectation);
            await this.testImagesClassExpection(classExpectationPath, classExpectation, className);
        }
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

