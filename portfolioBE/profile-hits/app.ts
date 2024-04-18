import { APIGatewayProxyEvent, APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { AWSError } from 'aws-sdk';
// import AWS from 'aws-sdk';
// AWS.config.update({ region: 'ap-southeast-2' });
import DynamoDB, {
    PutItemInput,
    PutItemOutput,
    PutItemInputAttributeMap,
    GetItemInput,
    GetItemOutput,
    QueryInput,
    UpdateItemInput,
} from 'aws-sdk/clients/dynamodb';
import { PromiseResult } from 'aws-sdk/lib/request';
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

async function HandlePostRequest(userAgent: string, location: string, device: string | null) {
    let date = new Date();
    let dateStr = date.toISOString();

    let [pkDate, skTime] = ['profileHit', dateStr.replace(/[-:T.]/g, '#').substring(0, dateStr.length - 1)];
    let Item: PutItemInputAttributeMap = {
        YM: { S: pkDate },
        DHMS: { S: skTime },
        UserAgent: { S: userAgent },
        Location: { S: location },
    };
    if (device) {
        Item = { ...Item, Device: { S: device } };
    }

    const TableName = 'portfoliorequests';
    const input: PutItemInput = {
        TableName,
        Item,
    };

    const profileHitRes = await dynamoDB
        .putItem(input, (err, output: PutItemOutput) => {
            if (err) console.log(err);
            if (output) console.log(output);
        })
        .promise()
        .then((data) => {
            console.log('SUCCESS in entering Row : profile hit info');
            // console.log(data.Attributes);
        })
        .catch((err) => {
            console.log('ERROR');
            console.log(err);
        });
    const UpdateItemObj: UpdateItemInput = {
        TableName,
        Key: { YM: { S: 'MetaData' }, DHMS: { S: 'NumRows' } },
        UpdateExpression: 'ADD rowCount :inc',
        // UpdateExpression: 'SET rowCount = rowCount + :inc',
        ExpressionAttributeValues: {
            ':inc': { N: '0.5' },
        },
        ReturnValues: 'ALL_NEW',
    };

    const numRowsRes = await dynamoDB
        .updateItem(UpdateItemObj, () => {})
        .promise()
        .then((data) => {
            // console.log(data);
        })
        .catch((err) => {
            console.log(err);
        });
    console.log(numRowsRes);
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Origin': 'https://www.valluri-tech.com',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
        },
        body: JSON.stringify({
            message: 'POST: Portfolio request executed successfully',
        }),
    };
}

async function HandleGetRequest(lastEvaluatedKey: any, totalNumberRows: any) {
    // console.log({ exclusiveStartKey });
    const TableName = 'portfoliorequests';

    // Lets try to get the number of rows if it was not recieved from client.

    let getRowsCountInput: GetItemInput = {
        TableName,
        Key: {
            YM: { S: 'MetaData' },
            DHMS: { S: 'NumRows' },
        },
        ProjectionExpression: 'rowCount',
    };

    let getRowsCountRes = await dynamoDB
        .getItem(getRowsCountInput)
        .promise()
        .then((res) => {
            return res?.Item?.rowCount?.N;
        })
        .catch((err) => console.log(err));

    // Query all the profile hits
    let date = new Date();
    date.setDate(date.getDate() + 1);
    let dateStr = date.toISOString();

    let sk = dateStr.substring(0, dateStr.indexOf('T')).replace(/-/g, '#');
    sk = sk + '#00#00#00#000';
    let getprofileHitRowsInput: QueryInput = {
        TableName,
        KeyConditionExpression: '#YearAndMonth = :v1 AND #DayHourMinSec <= :v2',
        ExpressionAttributeNames: { '#YearAndMonth': 'YM', '#DayHourMinSec': 'DHMS' },
        ExpressionAttributeValues: {
            ':v1': { S: 'profileHit' },
            ':v2': { S: sk },
        },
        Limit: 5,
        ScanIndexForward: false,
    };

    if (lastEvaluatedKey) {
        getprofileHitRowsInput = { ...getprofileHitRowsInput, ExclusiveStartKey: lastEvaluatedKey };
    }

    let getprofileHitRowsRes = await dynamoDB.query(getprofileHitRowsInput).promise();
    let clientRes = { ...getprofileHitRowsRes, totalNumberRows: getRowsCountRes };

    return {
        statusCode: 200,
        body: JSON.stringify(clientRes),
        headers: {
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
        },
    };
}

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log(event);
    try {
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
                const userAgent = event?.requestContext?.identity?.userAgent || '';
                const location = event?.requestContext?.identity?.sourceIp || '';
                let device = null;
                // if(event?.multiValueHeaders?.){
                //     device = 'Desktop'
                // }
                // event?.multiValueHeaders?['CloudFront-Is-Mobile-Viewer'][0] === 'true' && (device = 'Mobile');
                // event?.multiValueHeaders?['CloudFront-Is-SmartTV-Viewer'][0] === 'true' && (device = 'SmartTV');
                // event?.multiValueHeaders?['CloudFront-Is-Tablet-Viewer'][0] === 'true' && (device = 'Tablet');
                return await HandlePostRequest(userAgent, location, device);
            case 'GET':
                let LastEvaluatedKey = null;
                let totalNumberRows = null;
                if (event?.queryStringParameters && event?.queryStringParameters?.queryParams) {
                    let qps = JSON.parse(event?.queryStringParameters?.queryParams);
                    if (qps) {
                        LastEvaluatedKey = qps?.LastEvaluatedKey;
                        totalNumberRows = qps?.totalNumberRows;
                    }
                }
                //SAMPLE : event.queryStringParameters: { LEK: '{"YM":{"S":"2024-04"},"DHMS":{"S":"02#22#47#07#387"}}\n' },
                return await HandleGetRequest(LastEvaluatedKey, totalNumberRows);
            default:
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        message: 'Neither Get nor Post - Very rare',
                    }),
                };
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
