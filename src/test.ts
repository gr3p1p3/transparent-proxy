import { ProxyServer } from '../src/ProxyServer';

const server = new ProxyServer({
  verbose: true,
  intercept: true,
 
  }
);
server.listen(8888, () => {
  console.log('started')
})