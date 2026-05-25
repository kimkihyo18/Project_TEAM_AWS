export const config = {
  mode:     process.env.APP_MODE || 'local',
  port:     Number(process.env.PORT) || 3002,
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'localpassword',
    name:     process.env.DB_NAME     || 'hotel_db',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'local-dev-secret-key-2024',
  },
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID || '',
    clientId:   process.env.COGNITO_CLIENT_ID   || '',
    region:     process.env.AWS_REGION          || 'ap-northeast-2',
  },
  dynamo: {
    endpoint:  process.env.DYNAMO_ENDPOINT,
    region:    process.env.AWS_REGION   || 'ap-northeast-2',
    tableName: process.env.DYNAMO_TABLE || 'TravelBookingCache',
  },
  azure: {
    translatorKey:      process.env.AZURE_TRANSLATOR_KEY      || '',
    translatorEndpoint: process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com',
    translatorRegion:   process.env.AZURE_TRANSLATOR_REGION   || 'koreacentral',
  },
  s3: {
    region:       process.env.AWS_REGION              || 'ap-northeast-2',
    sourceBucket: process.env.S3_SOURCE_BUCKET        || '',
    outputBucket: process.env.S3_OUTPUT_BUCKET        || '',
    cdnDomain:    process.env.S3_CLOUDFRONT_DOMAIN    || '',
    lambdaSecret: process.env.LAMBDA_CALLBACK_SECRET  || 'local-secret',
  },
  mediaConvert: {
    endpoint: process.env.MEDIACONVERT_ENDPOINT || '',
    roleArn:  process.env.MEDIACONVERT_ROLE_ARN || '',
  },
  internal: {
    secret:         process.env.INTERNAL_SECRET         || 'local-internal-secret',
    bookingService: process.env.BOOKING_SERVICE_URL     || 'http://booking-service:3003',
    reviewService:  process.env.REVIEW_SERVICE_URL      || 'http://review-service:3004',
  },
  sqs: {
    endpoint: process.env.SQS_ENDPOINT  || 'http://elasticmq:9324',
    queueUrl: process.env.SQS_QUEUE_URL || 'http://elasticmq:9324/000000000000/rating-queue',
    region:   process.env.AWS_REGION    || 'ap-northeast-2',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
};

export const isLocal = config.mode === 'local';
export const isAWS   = config.mode === 'aws';

export async function loadSecrets(): Promise<void> {
  if (isLocal) return;
  const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
  const client = new SecretsManagerClient({ region: config.cognito.region });
  const { SecretString } = await client.send(
    new GetSecretValueCommand({ SecretId: 'travel-app/hotel-service' })
  );
  const values = JSON.parse(SecretString!);
  if (values.DB_PASSWORD)             process.env.DB_PASSWORD             = values.DB_PASSWORD;
  if (values.AZURE_TRANSLATOR_KEY)    process.env.AZURE_TRANSLATOR_KEY    = values.AZURE_TRANSLATOR_KEY;
  if (values.LAMBDA_CALLBACK_SECRET)  process.env.LAMBDA_CALLBACK_SECRET  = values.LAMBDA_CALLBACK_SECRET;
  if (values.INTERNAL_SECRET)         process.env.INTERNAL_SECRET         = values.INTERNAL_SECRET;
}
