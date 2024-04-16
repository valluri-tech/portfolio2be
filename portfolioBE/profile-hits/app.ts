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

async function HandlePostRequest(userAgent: string, location: string) {
    let date = new Date();
    let dateStr = date.toISOString();
    // let [pkDate, skTime] = dateStr.split('T');
    // skTime = skTime.replace(/[:.]/g, '#').slice(0, skTime.length - 1);

    // let pkDateFormatted = pkDate.slice(0, 7); //.replace('-', '');
    // // Extracted the Year and Month - which will become the primary key and replace : with -
    // let day = pkDate.slice(8, 10);
    // let skFormatted = day + '#' + skTime;

    let [pkDate, skTime] = ['profileHit', dateStr.replace(/[-:T.]/g, '#').substring(0, dateStr.length - 1)];
    const Item: PutItemInputAttributeMap = {
        YM: { S: pkDate },
        DHMS: { S: skTime },
        UserAgent: { S: userAgent },
        Location: { S: location },
    };

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
    console.log(profileHitRes);
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

async function HandleGetRequest(exclusiveStartKey: any) {
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
    console.log(JSON.stringify(getRowsCountRes));

    // Query all the profile hits
    let getprofileHitRowsInput: QueryInput = {
        TableName,
        KeyConditionExpression: '#YearAndMonth = :v1 AND #DayHourMinSec <= :v2',
        ExpressionAttributeNames: { '#YearAndMonth': 'YM', '#DayHourMinSec': 'DHMS' },
        ExpressionAttributeValues: {
            ':v1': { S: 'profileHit' },
            ':v2': { S: '2024#04#30#00#00#00#000' },
        },
        Limit: 2,
    };

    if (exclusiveStartKey) {
        getprofileHitRowsInput = { ...getprofileHitRowsInput, ExclusiveStartKey: exclusiveStartKey };
    }

    let getprofileHitRowsRes = await dynamoDB.query(getprofileHitRowsInput).promise();
    let clientRes = { ...getprofileHitRowsRes, totalNumberRows: getRowsCountRes };
    // console.log(JSON.stringify(res));
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
    try {
        // console.log(event);

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
                return await HandlePostRequest(userAgent, location);
            case 'GET':
                let esk = null;
                if (event?.queryStringParameters?.LastEvaluatedKey) {
                    esk = JSON.parse(event?.queryStringParameters?.LastEvaluatedKey);
                }
                //SAMPLE : event.queryStringParameters: { LEK: '{"YM":{"S":"2024-04"},"DHMS":{"S":"02#22#47#07#387"}}\n' },
                return await HandleGetRequest(esk);
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
