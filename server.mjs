import express from 'express'

import { dirname } from 'path';
import { fileURLToPath, URL } from 'url';


export default async function serve(url = 'http://localhost:48888') {
  const port = new URL(url).port;
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const app = express();
  app.use(express.static(__dirname));
  return new Promise((resolve, reject) => {
    const server = app.listen(port, err => {
      if (err) {
        reject(err);
      } else {
        console.log(`serving at: ${url}`);
        resolve(server);
      }
    });
  });
};
