import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
// import AWS from 'aws-sdk';
// AWS.config.update({ region: 'ap-southeast-2' });
import DynamoDB, { PutItemInput, PutItemOutput, PutItemInputAttributeMap } from 'aws-sdk/clients/dynamodb';
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

async function HandlePostRequest(userAgent: string, location: string) {
    let date = new Date();
    let dateStr = date.toISOString();
    let [pkDate, skTime] = dateStr.split('T');
    skTime = skTime.replace(/[:.]/g, '#').slice(0, skTime.length - 1);

    const Item: PutItemInputAttributeMap = {
        Date: { S: pkDate },
        Time: { S: skTime },
        UserAgent: { S: userAgent },
        Location: { S: location },
    };
    const TableName = 'portfoliorequests';
    const input: PutItemInput = {
        TableName,
        Item,
    };

    const res = await dynamoDB
        .putItem(input, (err, output: PutItemOutput) => {
            if (err) console.log(err);
            if (output) console.log(output);
        })
        .promise()
        .then((data) => {
            console.log('SUCCESS');
            console.log(data.Attributes);
        })
        .catch((err) => {
            console.log('ERROR');
            console.log(err);
        });

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Hello world - from Satya',
        }),
    };
}

function HandleGetRequest() {}

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        console.log(event);
        const userAgent = event?.requestContext?.identity?.userAgent || '';
        const location = event?.requestContext?.identity?.sourceIp || '';
        const method = event.httpMethod;

        if (!['POST', 'GET'].includes(event.httpMethod)) {
            return {
                statusCode: 405,
                body: JSON.stringify({
                    message: `${method} : Method not supported`,
                }),
            };
        }

        switch (event.httpMethod) {
            case 'POST':
                return await HandlePostRequest(userAgent, location);
            case 'GET':
                return await HandleGetRequest();
            default:
                break;
        }
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'LAMBDA Error - Portfolio Save',
            }),
        };
    }
};
