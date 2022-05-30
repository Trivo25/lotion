let lotion = require("./dist");

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
  p2pPort: 26659,
  rpcPort: 26658,
  abciPort: 26658,
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
