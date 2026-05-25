export const config = {
  mode:     process.env.APP_MODE || 'local',
  port:     Number(process.env.PORT) || 3001,
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || 'localpassword',
    name:     process.env.DB_NAME     || 'auth_db',
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
    secret: process.env.INTERNAL_SECRET || 'local-internal-secret',
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
    new GetSecretValueCommand({ SecretId: 'travel-app/auth-service' })
  );
  const values = JSON.parse(SecretString!);
  if (values.DB_PASSWORD)        process.env.DB_PASSWORD        = values.DB_PASSWORD;
  if (values.JWT_SECRET)         process.env.JWT_SECRET         = values.JWT_SECRET;
  if (values.COGNITO_CLIENT_ID)  process.env.COGNITO_CLIENT_ID  = values.COGNITO_CLIENT_ID;
}
