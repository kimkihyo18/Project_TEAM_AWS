export const config = {
  mode:     process.env.APP_MODE || 'local',
  port:     Number(process.env.PORT) || 3004,
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'localpassword',
    name:     process.env.DB_NAME     || 'review_db',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'local-dev-secret-key-2024',
  },
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID || '',
    clientId:   process.env.COGNITO_CLIENT_ID   || '',
    region:     process.env.AWS_REGION          || 'ap-northeast-2',
  },
  internal: {
    secret:         process.env.INTERNAL_SECRET     || 'local-internal-secret',
    hotelService:   process.env.HOTEL_SERVICE_URL   || 'http://hotel-service:3002',
    bookingService: process.env.BOOKING_SERVICE_URL || 'http://booking-service:3003',
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
    new GetSecretValueCommand({ SecretId: 'travel-app/review-service' })
  );
  const values = JSON.parse(SecretString!);
  if (values.DB_PASSWORD)     process.env.DB_PASSWORD     = values.DB_PASSWORD;
  if (values.INTERNAL_SECRET) process.env.INTERNAL_SECRET = values.INTERNAL_SECRET;
}
