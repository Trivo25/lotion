/* import lotion from "./dist";
import getPort from "get-port";
 let { parseTx } = require("./dist/parseTx");

let byte = parseTx({
  some: 123,
});
console.log(byte); 

let app = lotion({
  initialState: {
    count: 0,
  },
  logTendermint: true,
  p2pPort: getPort(),
  rpcPort: getPort(),
  abciPort: getPort(),
});

app.use(function (state, tx) {
  state.count++;
  console.log(state);
});

app.start();

/* 
let createServer = require("./dist/server");
let server = createServer({
  info(request) {
    console.log("got info request", request);
    return {};
  },

  // implement any ABCI method handlers here
});
server.listen(26658);
 */
 */