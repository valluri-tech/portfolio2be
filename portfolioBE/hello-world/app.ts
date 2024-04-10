import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
// import AWS from 'aws-sdk';
// AWS.config.update({ region: 'ap-southeast-2' });
import DynamoDB from 'aws-sdk/clients/dynamodb';
// import DocumentClient from 'aws-sdk/lib/dynamodb/document_client';

// import DynamoDB from './node_modules/aws-sdk/clients/dynamodb';
// import {DocumentClient} from './node_modules/aws-sdk/lib/dynamodb/document_client';
// const client = new DynamoDB({});
// const docClient = DocumentClient.
const dynamoDB = new DynamoDB({});

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // const isDesktopRequest = event.headers['CloudFront-Is-Desktop-Viewer'];
        // const isMobileRequest = event.headers['CloudFront-Is-Mobile-Viewer'];
        // const isTabletRequest = event.headers['CloudFront-Is-Tablet-Viewer'];
        // const userAgent = event.headers['User-Agent'];
        // const location = event?.headers['X-Forwarded-For']?.split(',')[0];
        // const atTime = event.requestContext.requestTimeEpoch;

        // let date = new Date();
        // date.setUTCSeconds(atTime);
        // const [yyyy, mm, dd, hr, min, ss] = [
        //     date.getFullYear(),
        //     date.getMonth(),
        //     date.getDate(),
        //     date.getHours(),
        //     date.getMinutes(),
        //     date.getSeconds(),
        // ];
        // const pk = `${yyyy}-${mm}-${dd}`;
        // const sk = `${hr}-${min}-${ss}`;
        // console.log({ isDesktopRequest, isMobileRequest, isTabletRequest, pk, sk, from: location, userAgent });

        // try {
        //     const dynamoDB = new AWS.DynamoDB();
        //     console.log(dynamoDB);
        // } catch (err) {
        //     console.log(err);
        // }
        const res = await dynamoDB
            .listTables({}, (err, data) => {
                if (err) {
                    console.log(err);
                } else {
                    console.log(data);
                }
            })
            .promise();

        console.log('done executing dynamodb call - result below');
        console.log(res);
        // dynamoDB.describeTable();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Hello world - from Satya',
            }),
        };
    } catch (err) {
        console.log(err);
        console.log('Err Above');

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'some error happened',
            }),
        };
    }
};
