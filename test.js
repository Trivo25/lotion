let lotion = require("./dist");

let app = lotion({
  initialState: {
    count: 0,
  },
  logTendermint: true,
  p2pPort: 25551,
  rpcPort: 25552,
  abciPort: 25553,
  baseDir: ".data",
});

app.use(function (state, tx) {
  state.count++;
  console.log(state);
  return {
    code: 1,
  };
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
