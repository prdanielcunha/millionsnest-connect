import dotenv from 'dotenv';
import { createConnectServer } from './src/server/createConnectServer';

dotenv.config();

const port = Number(process.env.PORT || 8080);
const app = createConnectServer();

app.listen(port, '0.0.0.0', () => {
  console.info('CONNECT_CORE_SERVER_STARTED', {
    port,
    service: 'millionsnest-connect-core',
  });
});
